import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

// Only who the account is. Sync asks for calendar access later through incremental authorization.
export const SCOPES = ['openid', 'email'] as const;

/**
 * The OAuth client the maintainer registers as a Google "Desktop app". Google requires its secret even with PKCE; for
 * installed apps it isn't confidential, but it is injected at build time like the id, never committed.
 */
export type OAuthClient = { id: string; secret: string };

const clientSchema = z.object({ id: z.string().trim().min(1), secret: z.string().trim().min(1) });

/** The client from build-time values, or null when this build has none (Google features stay off). */
export const oauthClientFrom = (values: { id: string | undefined; secret: string | undefined }): OAuthClient | null => {
	const parsed = clientSchema.safeParse(values);
	return parsed.success ? parsed.data : null;
};

/** The subset of `fetch` the flow uses, so tests can stand in for Google. */
export type Fetch = (url: string, init: { body: URLSearchParams; method: 'POST' }) => Promise<{ json: () => Promise<unknown>; ok: boolean; status: number }>;

const base64Url = (bytes: Buffer): string => bytes.toString('base64url');

/** A random value for `state` or a PKCE verifier: 32 bytes, 43 base64url characters (RFC 7636 allows 43–128). */
export const randomToken = (): string => base64Url(randomBytes(32));

/** The S256 PKCE challenge for `verifier`. */
export const pkceChallenge = (verifier: string): string => base64Url(createHash('sha256').update(verifier).digest());

export const authorizationUrl = (client: OAuthClient, request: { redirectUri: string; state: string; verifier: string }): string => {
	const url = new URL(AUTH_ENDPOINT);
	url.search = new URLSearchParams({
		client_id: client.id,
		code_challenge: pkceChallenge(request.verifier),
		code_challenge_method: 'S256',
		include_granted_scopes: 'true',
		// Always ask, so Google always returns a refresh token, and let the user pick which account.
		prompt: 'select_account consent',
		redirect_uri: request.redirectUri,
		response_type: 'code',
		scope: SCOPES.join(' '),
		state: request.state,
	}).toString();
	return url.toString();
};

const tokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.number().int().positive(),
	id_token: z.string().min(1),
	refresh_token: z.string().min(1),
	scope: z.string(),
});

const idTokenClaimsSchema = z.object({ aud: z.string(), email: z.email(), sub: z.string().min(1) });

/** What a successful code exchange yields: the tokens and who signed in. */
export type GrantedTokens = { accessToken: string; email: string; expiresAt: string; refreshToken: string; scope: string; subject: string };

/** Thrown for any answer from Google the flow can't use; `message` is a developer description. */
export class OAuthError extends Error {
	override name = 'OAuthError';
}

/**
 * The id token's claims. Its signature isn't checked: it comes straight from Google's token endpoint over TLS, which
 * Google documents as enough. The audience still has to be this client.
 */
const idTokenClaims = (idToken: string, clientId: string) => {
	const [, payload] = idToken.split('.');
	if (payload === undefined) throw new OAuthError('The id token is not a JWT');
	let json: unknown;
	try {
		json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
	} catch {
		throw new OAuthError('The id token payload is not JSON');
	}
	const claims = idTokenClaimsSchema.safeParse(json);
	if (!claims.success) throw new OAuthError(`The id token lacks claims: ${claims.error.message}`);
	if (claims.data.aud !== clientId) throw new OAuthError('The id token was issued to another client');
	return claims.data;
};

/** Trades the authorization code for tokens (with the PKCE verifier) and reads who signed in. */
export const exchangeCode = async (fetch: Fetch, client: OAuthClient, grant: { code: string; now: Date; redirectUri: string; verifier: string }): Promise<GrantedTokens> => {
	const response = await fetch(TOKEN_ENDPOINT, {
		body: new URLSearchParams({
			client_id: client.id,
			client_secret: client.secret,
			code: grant.code,
			code_verifier: grant.verifier,
			grant_type: 'authorization_code',
			redirect_uri: grant.redirectUri,
		}),
		method: 'POST',
	});
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok) throw new OAuthError(`Token exchange failed with ${response.status}: ${JSON.stringify(body)}`);
	const tokens = tokenResponseSchema.safeParse(body);
	if (!tokens.success) throw new OAuthError(`Unexpected token response: ${tokens.error.message}`);
	const claims = idTokenClaims(tokens.data.id_token, client.id);
	return {
		accessToken: tokens.data.access_token,
		email: claims.email,
		expiresAt: new Date(grant.now.getTime() + tokens.data.expires_in * 1000).toISOString(),
		refreshToken: tokens.data.refresh_token,
		scope: tokens.data.scope,
		subject: claims.sub,
	};
};

/**
 * Revokes the grant at Google: revoking the refresh token ends its access tokens too. A token Google no longer knows
 * (400) is already as good as revoked.
 */
export const revokeToken = async (fetch: Fetch, token: string): Promise<void> => {
	const response = await fetch(REVOKE_ENDPOINT, { body: new URLSearchParams({ token }), method: 'POST' });
	if (!response.ok && response.status !== 400) throw new OAuthError(`Revoking failed with ${response.status}`);
};
