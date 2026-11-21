import { z } from 'zod';
import { missingScopes } from './scopes';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/** How long a call to Google's OAuth endpoints may take, body included, before Google counts as unreachable. */
export const OAUTH_TIMEOUT_MS = 30_000;

/** Refresh this long before the access token expires, so it never lapses mid-request. */
export const DEFAULT_REFRESH_MARGIN_MS = 60_000;

/**
 * The caller's OAuth client. Google requires the secret for "Desktop app" and web clients even with PKCE; leave it out
 * only for client types that have none.
 */
export type OAuthClient = { id: string; secret?: string };

/** The subset of `fetch` the OAuth calls use, so tests can stand in for Google. */
export type OAuthFetch = (url: string, init: { body: URLSearchParams; method: 'POST'; signal: AbortSignal }) => Promise<{ json: () => Promise<unknown>; ok: boolean; status: number }>;

/** Thrown for any answer from Google the flow can't use; `message` is a developer description. */
export class OAuthError extends Error {
	override name = 'OAuthError';
}

/** Thrown when Google can't be reached at all. */
export class OAuthNetworkError extends OAuthError {
	override name = 'OAuthNetworkError';
}

/** Thrown when Google no longer honors the refresh token (revoked, expired, password changed): sign in again. */
export class GrantRevokedError extends OAuthError {
	override name = 'GrantRevokedError';
}

/** Thrown by `getAccessToken` when `load` has no tokens: sign in first. */
export class NotSignedInError extends OAuthError {
	override name = 'NotSignedInError';
}

/** Thrown by `getAccessToken` when the stored grant lacks a required scope: sign in again to grant it. */
export class MissingScopesError extends OAuthError {
	override name = 'MissingScopesError';
	readonly missing: string[];
	constructor(missing: string[]) {
		super(`The grant lacks ${missing.join(' ')}`);
		this.missing = missing;
	}
}

const base64Url = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');

const fromBase64Url = (text: string): string => {
	const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
	const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
	return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
};

/** A random value for `state` or a PKCE verifier: 32 bytes, 43 base64url characters (RFC 7636 allows 43–128). */
export const randomToken = (): string => base64Url(crypto.getRandomValues(new Uint8Array(32)));

/** The S256 PKCE challenge for `verifier`. */
export const pkceChallenge = async (verifier: string): Promise<string> => base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

/** A fresh PKCE pair: keep `verifier` for the code exchange, send `challenge` in the authorization URL. */
export const createPkce = async (): Promise<{ challenge: string; verifier: string }> => {
	const verifier = randomToken();
	return { challenge: await pkceChallenge(verifier), verifier };
};

export type AuthorizationRequest = {
	clientId: string;
	redirectUri: string;
	scopes: readonly string[];
	state: string;
	/** From `createPkce`; the method is always S256. */
	codeChallenge: string;
	/** `offline` asks for a refresh token for web clients; installed-app clients get one without it. */
	accessType?: 'offline' | 'online';
	prompt?: readonly ('consent' | 'none' | 'select_account')[];
	loginHint?: string;
	includeGrantedScopes?: boolean;
};

/** Google's consent page for `request`; options left out are not sent. */
export const authorizationUrl = (request: AuthorizationRequest): string => {
	const params = new URLSearchParams({
		client_id: request.clientId,
		code_challenge: request.codeChallenge,
		code_challenge_method: 'S256',
		redirect_uri: request.redirectUri,
		response_type: 'code',
		scope: request.scopes.join(' '),
		state: request.state,
	});
	if (request.accessType !== undefined) params.set('access_type', request.accessType);
	if (request.includeGrantedScopes !== undefined) params.set('include_granted_scopes', String(request.includeGrantedScopes));
	if (request.loginHint !== undefined) params.set('login_hint', request.loginHint);
	if (request.prompt !== undefined && request.prompt.length > 0) params.set('prompt', request.prompt.join(' '));
	params.sort();
	const url = new URL(AUTH_ENDPOINT);
	url.search = params.toString();
	return url.toString();
};

/** Posts `body` to an OAuth endpoint; a connection that drops (or a body cut off by the deadline) is a network error. */
const post = async (fetch: OAuthFetch, url: string, body: URLSearchParams, timeoutMs: number): Promise<{ json: unknown; ok: boolean; status: number }> => {
	// Without a deadline, a dropped connection would leave the caller waiting forever.
	const signal = AbortSignal.timeout(timeoutMs);
	try {
		const response = await fetch(url, { body, method: 'POST', signal });
		const json: unknown = await response.json().catch((error: unknown) => {
			if (signal.aborted) throw error;
			return null;
		});
		return { json, ok: response.ok, status: response.status };
	} catch (error) {
		throw new OAuthNetworkError(`Google could not be reached at ${url}: ${error instanceof Error ? error.message : String(error)}`);
	}
};

const withClient = (client: OAuthClient, values: Record<string, string>): URLSearchParams => {
	const body = new URLSearchParams({ client_id: client.id, ...values });
	if (client.secret !== undefined) body.set('client_secret', client.secret);
	return body;
};

const tokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.number().int().positive(),
	id_token: z.string().min(1).optional(),
	refresh_token: z.string().min(1).optional(),
	scope: z.string(),
});

const idTokenClaimsSchema = z.object({ aud: z.string(), email: z.email().optional(), sub: z.string().min(1) });

/** Who signed in, from the ID token: `email` only when the `email` scope was granted. */
export type SignedInAccount = { email: string | null; subject: string };

export type CodeExchange = {
	accessToken: string;
	expiresAt: string;
	/** Null when Google sent none (an online grant, or a re-consent that kept the old one). */
	refreshToken: string | null;
	/** The scopes actually granted, space-separated; may be fewer than requested. */
	scope: string;
	/** Present when `openid` was requested. */
	account: SignedInAccount | null;
};

/**
 * The ID token's claims. Its signature isn't checked: it comes straight from Google's token endpoint over TLS, which
 * Google documents as enough. The audience still has to be this client.
 */
const idTokenAccount = (idToken: string, clientId: string): SignedInAccount => {
	const [, payload] = idToken.split('.');
	if (payload === undefined) throw new OAuthError('The ID token is not a JWT');
	let json: unknown;
	try {
		json = JSON.parse(fromBase64Url(payload));
	} catch {
		throw new OAuthError('The ID token payload is not JSON');
	}
	const claims = idTokenClaimsSchema.safeParse(json);
	if (!claims.success) throw new OAuthError(`The ID token lacks claims: ${claims.error.message}`);
	if (claims.data.aud !== clientId) throw new OAuthError('The ID token was issued to another client');
	return { email: claims.data.email ?? null, subject: claims.data.sub };
};

const expiry = (now: Date, expiresIn: number): string => new Date(now.getTime() + expiresIn * 1000).toISOString();

/** Trades the authorization code (with its PKCE verifier) for tokens and, with `openid`, who signed in. */
export const exchangeCode = async (options: { fetch: OAuthFetch; client: OAuthClient; code: string; verifier: string; redirectUri: string; now?: Date; timeoutMs?: number }): Promise<CodeExchange> => {
	const body = withClient(options.client, { code: options.code, code_verifier: options.verifier, grant_type: 'authorization_code', redirect_uri: options.redirectUri });
	const response = await post(options.fetch, TOKEN_ENDPOINT, body, options.timeoutMs ?? OAUTH_TIMEOUT_MS);
	if (!response.ok) throw new OAuthError(`Token exchange failed with ${response.status}: ${JSON.stringify(response.json)}`);
	const tokens = tokenResponseSchema.safeParse(response.json);
	if (!tokens.success) throw new OAuthError(`Unexpected token response: ${tokens.error.message}`);
	return {
		accessToken: tokens.data.access_token,
		account: tokens.data.id_token === undefined ? null : idTokenAccount(tokens.data.id_token, options.client.id),
		expiresAt: expiry(options.now ?? new Date(), tokens.data.expires_in),
		refreshToken: tokens.data.refresh_token ?? null,
		scope: tokens.data.scope,
	};
};

const refreshResponseSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive(), scope: z.string().optional() });

export type RefreshedToken = { accessToken: string; expiresAt: string; scope: string | undefined };

/** A new access token from the refresh token. */
export const refreshAccessToken = async (options: { fetch: OAuthFetch; client: OAuthClient; refreshToken: string; now?: Date; timeoutMs?: number }): Promise<RefreshedToken> => {
	const body = withClient(options.client, { grant_type: 'refresh_token', refresh_token: options.refreshToken });
	const response = await post(options.fetch, TOKEN_ENDPOINT, body, options.timeoutMs ?? OAUTH_TIMEOUT_MS);
	if (!response.ok) {
		const detail = `Refreshing failed with ${response.status}: ${JSON.stringify(response.json)}`;
		throw response.status === 400 && JSON.stringify(response.json).includes('invalid_grant') ? new GrantRevokedError(detail) : new OAuthError(detail);
	}
	const tokens = refreshResponseSchema.safeParse(response.json);
	if (!tokens.success) throw new OAuthError(`Unexpected refresh response: ${tokens.error.message}`);
	return { accessToken: tokens.data.access_token, expiresAt: expiry(options.now ?? new Date(), tokens.data.expires_in), scope: tokens.data.scope };
};

/**
 * Revokes a grant at Google: revoking the refresh token ends its access tokens too. A token Google no longer knows
 * (400) is already as good as revoked.
 */
export const revokeToken = async (options: { fetch: OAuthFetch; token: string; timeoutMs?: number }): Promise<void> => {
	const response = await post(options.fetch, REVOKE_ENDPOINT, new URLSearchParams({ token: options.token }), options.timeoutMs ?? OAUTH_TIMEOUT_MS);
	if (!response.ok && response.status !== 400) throw new OAuthError(`Revoking failed with ${response.status}`);
};

/** The token fields `getAccessToken` reads and updates; callers keep whatever else they store beside them. */
export type StoredTokens = { accessToken: string; expiresAt: string; refreshToken: string; scope: string };

/**
 * A valid access token: the stored one while it has more than `refreshMarginMs` left, otherwise a refreshed one that is
 * handed to `save` first. The SDK never stores tokens itself; `load` and `save` are the caller's storage.
 */
export const getAccessToken = async <T extends StoredTokens>(options: {
	fetch: OAuthFetch;
	client: OAuthClient;
	load: () => Promise<T | null>;
	save: (tokens: T) => Promise<void>;
	/** Checked against the stored grant before it is used; throws `MissingScopesError` when one is missing. */
	requiredScopes?: readonly string[];
	refreshMarginMs?: number;
	now?: () => Date;
	timeoutMs?: number;
}): Promise<string> => {
	const stored = await options.load();
	if (stored === null) throw new NotSignedInError('No tokens are stored');
	const missing = missingScopes(stored.scope, options.requiredScopes ?? []);
	if (missing.length > 0) throw new MissingScopesError(missing);
	const now = options.now?.() ?? new Date();
	if (Date.parse(stored.expiresAt) - (options.refreshMarginMs ?? DEFAULT_REFRESH_MARGIN_MS) > now.getTime()) return stored.accessToken;
	const refreshed = await refreshAccessToken({ client: options.client, fetch: options.fetch, now, refreshToken: stored.refreshToken, timeoutMs: options.timeoutMs });
	await options.save({ ...stored, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt, scope: refreshed.scope ?? stored.scope });
	return refreshed.accessToken;
};
