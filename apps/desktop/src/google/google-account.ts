import { fail, type GoogleAccount, type GoogleConnectResult, ok, type Result } from '@tempi/core';
import type { FetchLike } from '@usemeshly/auth';
import { type AuthorizationRequest, createAuthorizationRequest, createTokenManager, exchangeCode, type GetAccessTokenOptions, type OAuthClient, type OAuthTokens, revoke } from '@usemeshly/auth/oauth';
import { googleOAuthProvider, hasScopes } from '@usemeshly/google-calendar';
import type { LoopbackOptions, LoopbackRedirect } from './loopback';
import { CALENDAR_SCOPES, SCOPES } from './oauth';
import type { StoredAccount, TokenStore } from './token-store';

/** How long the browser sign-in may take before connecting gives up. */
export const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

export type GoogleAccountDeps = {
	/** Null when this build has no OAuth client: every call that needs Google fails with `google.notConfigured`. */
	client: OAuthClient | null;
	store: TokenStore;
	fetch: FetchLike;
	listen: (options: LoopbackOptions) => Promise<LoopbackRedirect>;
	/** Opens the sign-in page in the system browser, never inside the app. */
	openBrowser: (url: string) => Promise<void>;
	/** Where the browser goes once Google redirects back. */
	landingUrl: (succeeded: boolean) => string;
};

export type GoogleAccountService = {
	account: () => Promise<GoogleAccount | null>;
	/** OAuth 2.0 with PKCE through the system browser and a loopback redirect. Only one account can be connected. */
	connect: () => Promise<Result<GoogleConnectResult>>;
	/** Revokes the grant at Google and deletes the tokens. Offline, the tokens are deleted anyway and the failure logged. */
	disconnect: () => Promise<Result<null>>;
	/**
	 * A valid access token for the Calendar client, refreshed (and stored) when it is about to expire. Rejects with the
	 * library's `MeshlyError` (`not_signed_in`, `missing_scopes`, `invalid_grant`, `network_error`, …), which the sync
	 * runner turns into a status.
	 */
	getAccessToken: (options?: GetAccessTokenOptions) => Promise<string>;
};

/** The stored account in the token manager's shape; `email` and `subject` ride along untouched. */
type AccountTokens = OAuthTokens & Pick<StoredAccount, 'email' | 'subject'>;

const toTokens = (stored: StoredAccount): AccountTokens => ({
	accessToken: stored.accessToken,
	email: stored.email,
	expiresAt: Date.parse(stored.expiresAt),
	idToken: null,
	idTokenClaims: null,
	refreshToken: stored.refreshToken,
	scopes: stored.scope.split(' ').filter(scope => scope !== ''),
	subject: stored.subject,
	tokenType: 'bearer',
});

// Google always says when an access token expires; without it, it counts as expired so the next call refreshes.
const expiryOf = (tokens: OAuthTokens): string => new Date(tokens.expiresAt ?? Date.now()).toISOString();

const authFailed = (detail: string) => fail<GoogleConnectResult>('internal', 'google.authFailed', { detail });

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const createGoogleAccountService = (deps: GoogleAccountDeps): GoogleAccountService => {
	const { client } = deps;
	// A second connect replaces a sign-in still waiting in the browser, which then ends as canceled.
	let pending: AbortController | null = null;

	const tokens =
		client === null
			? null
			: createTokenManager<AccountTokens>({
					client,
					fetch: deps.fetch,
					load: async () => {
						const stored = await deps.store.read();
						return stored === null ? null : toTokens(stored);
					},
					provider: googleOAuthProvider,
					requiredScopes: CALENDAR_SCOPES,
					save: next => {
						if (next.refreshToken === null) throw new Error('Refusing to store Google tokens without a refresh token');
						return deps.store.write({
							accessToken: next.accessToken,
							email: next.email,
							expiresAt: expiryOf(next),
							refreshToken: next.refreshToken,
							scope: (next.scopes ?? []).join(' '),
							subject: next.subject,
						});
					},
				});

	const revokeGrant = async (refreshToken: string, reason: string) => {
		if (client === null) return;
		await revoke(googleOAuthProvider, client, refreshToken, { fetch: deps.fetch, tokenTypeHint: 'refresh_token' }).catch((error: unknown) => console.error(reason, error));
	};

	// An account connected without calendar access may connect again, replacing its grant.
	const isFullyConnected = async () => {
		const stored = await deps.store.read();
		return stored !== null && hasScopes(stored.scope, CALENDAR_SCOPES);
	};

	const signIn = async (client: OAuthClient, controller: AbortController): Promise<Result<GoogleConnectResult>> => {
		const { signal } = controller;
		let request: AuthorizationRequest | null = null;
		const { outcome, redirectUri } = await deps.listen({ landingUrl: deps.landingUrl, signal, state: () => request?.state ?? null, timeoutMs: SIGN_IN_TIMEOUT_MS });
		try {
			request = await createAuthorizationRequest(googleOAuthProvider, client, {
				// Always ask, so Google always returns a refresh token, and let the user pick which account.
				extraParams: { prompt: 'select_account consent' },
				fetch: deps.fetch,
				redirectUri,
				scopes: SCOPES,
			});
			await deps.openBrowser(request.url);
		} catch (error) {
			controller.abort();
			throw error;
		}

		const ended = await outcome;
		if (ended.kind === 'aborted') return ok({ status: 'canceled' });
		if (ended.kind === 'timeout') return fail('internal', 'google.timeout');
		const error = ended.params.get('error');
		if (error === 'access_denied') return ok({ status: 'canceled' });
		if (error !== null || !ended.params.has('code')) return authFailed(`Google redirected back with error "${error ?? 'no code'}"`);

		const callbackUrl = new URL(redirectUri);
		callbackUrl.search = ended.params.toString();
		let granted: OAuthTokens;
		try {
			granted = await exchangeCode(googleOAuthProvider, client, {
				callbackUrl,
				codeVerifier: request.codeVerifier,
				expectedNonce: request.nonce,
				expectedState: request.state,
				fetch: deps.fetch,
				redirectUri,
			});
		} catch (error) {
			return authFailed(describe(error));
		}
		const { idTokenClaims, refreshToken } = granted;
		// Tempi syncs in the background and shows who is connected, so it needs both.
		if (refreshToken === null) return authFailed('Google sent no refresh token');
		if (idTokenClaims?.email === undefined) return authFailed('Google sent no email for the account');
		const account: StoredAccount = {
			accessToken: granted.accessToken,
			email: idTokenClaims.email,
			expiresAt: expiryOf(granted),
			refreshToken,
			scope: (granted.scopes ?? []).join(' '),
			subject: idTokenClaims.sub,
		};
		// Another connect may have finished first while this one exchanged its code.
		if (signal.aborted || (await isFullyConnected())) {
			await revokeGrant(refreshToken, 'Could not revoke an unused Google grant');
			return signal.aborted ? ok({ status: 'canceled' }) : fail('conflict', 'google.alreadyConnected');
		}
		await deps.store.write(account);
		return ok({ account: { email: account.email }, status: 'connected' });
	};

	return {
		account: async () => {
			const stored = await deps.store.read();
			return stored === null ? null : { email: stored.email };
		},
		connect: async () => {
			if (client === null) return fail('internal', 'google.notConfigured');
			if (!(await deps.store.isAvailable())) return fail('internal', 'google.encryptionUnavailable');
			if (await isFullyConnected()) return fail('conflict', 'google.alreadyConnected');

			pending?.abort();
			const controller = new AbortController();
			pending = controller;
			try {
				return await signIn(client, controller);
			} finally {
				if (pending === controller) pending = null;
			}
		},
		disconnect: async () => {
			const stored = await deps.store.read();
			// Nothing readable may be left; the file is dropped either way.
			if (stored !== null) await revokeGrant(stored.refreshToken, 'Could not revoke the Google grant; deleting the tokens anyway');
			await deps.store.clear();
			return ok(null);
		},
		getAccessToken: options => {
			if (tokens === null) return Promise.reject(new Error('This build has no Google OAuth client'));
			return tokens.getAccessToken(options);
		},
	};
};
