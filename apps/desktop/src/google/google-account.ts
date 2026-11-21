import { fail, type GoogleAccount, type GoogleConnectResult, ok, type Result } from '@tempi/core';
import {
	authorizationUrl,
	type CodeExchange,
	createPkce,
	exchangeCode,
	GrantRevokedError,
	getAccessToken,
	hasScopes,
	MissingScopesError,
	NotSignedInError,
	type OAuthClient,
	type OAuthFetch,
	OAuthNetworkError,
	randomToken,
	revokeToken,
} from '@tempi/google-calendar';
import type { LoopbackOptions, LoopbackRedirect } from './loopback';
import { CALENDAR_SCOPES, SCOPES } from './oauth';
import type { TokenStore } from './token-store';

/** How long the browser sign-in may take before connecting gives up. */
export const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

export type GoogleAccountDeps = {
	/** Null when this build has no OAuth client: every call that needs Google fails with `google.notConfigured`. */
	client: OAuthClient | null;
	store: TokenStore;
	fetch: OAuthFetch;
	listen: (options: LoopbackOptions) => Promise<LoopbackRedirect>;
	/** Opens the sign-in page in the system browser, never inside the app. */
	openBrowser: (url: string) => Promise<void>;
	/** Where the browser goes once Google redirects back. */
	landingUrl: (succeeded: boolean) => string;
	now: () => Date;
};

export type GoogleAccountService = {
	account: () => Promise<GoogleAccount | null>;
	/** OAuth 2.0 with PKCE through the system browser and a loopback redirect. Only one account can be connected. */
	connect: () => Promise<Result<GoogleConnectResult>>;
	/** Revokes the grant at Google and deletes the tokens. Offline, the tokens are deleted anyway and the failure logged. */
	disconnect: () => Promise<Result<null>>;
	/**
	 * A valid access token, refreshed when it is about to expire. Fails with `google.reconnectRequired` when there is no
	 * usable grant (none, revoked, or from before calendar access), and `google.offline` when Google can't be reached.
	 */
	accessToken: () => Promise<Result<string>>;
};

const reconnectRequired = (detail: string) => fail<string>('conflict', 'google.reconnectRequired', { detail });

const authFailed = (detail: string) => fail<GoogleConnectResult>('internal', 'google.authFailed', { detail });

export const createGoogleAccountService = (deps: GoogleAccountDeps): GoogleAccountService => {
	// A second connect replaces a sign-in still waiting in the browser, which then ends as canceled.
	let pending: AbortController | null = null;

	// An account connected without calendar access may connect again, replacing its grant.
	const isFullyConnected = async () => {
		const stored = await deps.store.read();
		return stored !== null && hasScopes(stored.scope, CALENDAR_SCOPES);
	};

	const signIn = async (client: OAuthClient, controller: AbortController): Promise<Result<GoogleConnectResult>> => {
		const { signal } = controller;
		const state = randomToken();
		const { challenge, verifier } = await createPkce();
		const { outcome, redirectUri } = await deps.listen({ landingUrl: deps.landingUrl, signal, state, timeoutMs: SIGN_IN_TIMEOUT_MS });
		try {
			await deps.openBrowser(
				authorizationUrl({
					clientId: client.id,
					codeChallenge: challenge,
					includeGrantedScopes: true,
					// Always ask, so Google always returns a refresh token, and let the user pick which account.
					prompt: ['select_account', 'consent'],
					redirectUri,
					scopes: SCOPES,
					state,
				})
			);
		} catch (error) {
			controller.abort();
			throw error;
		}

		const ended = await outcome;
		if (ended.kind === 'aborted') return ok({ status: 'canceled' });
		if (ended.kind === 'timeout') return fail('internal', 'google.timeout');
		const error = ended.params.get('error');
		if (error === 'access_denied') return ok({ status: 'canceled' });
		const code = ended.params.get('code');
		if (error !== null || code === null) return authFailed(`Google redirected back with error "${error ?? 'no code'}"`);

		let exchanged: CodeExchange;
		try {
			exchanged = await exchangeCode({ client, code, fetch: deps.fetch, now: deps.now(), redirectUri, verifier });
		} catch (error) {
			return authFailed(error instanceof Error ? error.message : String(error));
		}
		const { account, refreshToken } = exchanged;
		// Tempi syncs in the background and shows who is connected, so it needs both.
		if (refreshToken === null) return authFailed('Google sent no refresh token');
		if (account === null || account.email === null) return authFailed('Google sent no email for the account');
		const tokens = { accessToken: exchanged.accessToken, email: account.email, expiresAt: exchanged.expiresAt, refreshToken, scope: exchanged.scope, subject: account.subject };
		// Another connect may have finished first while this one exchanged its code.
		if (signal.aborted || (await isFullyConnected())) {
			await revokeToken({ fetch: deps.fetch, token: tokens.refreshToken }).catch((error: unknown) => console.error('Could not revoke an unused Google grant', error));
			return signal.aborted ? ok({ status: 'canceled' }) : fail('conflict', 'google.alreadyConnected');
		}
		await deps.store.write(tokens);
		return ok({ account: { email: tokens.email }, status: 'connected' });
	};

	return {
		accessToken: async () => {
			if (deps.client === null) return fail('internal', 'google.notConfigured');
			try {
				return ok(await getAccessToken({ client: deps.client, fetch: deps.fetch, load: deps.store.read, now: deps.now, requiredScopes: CALENDAR_SCOPES, save: deps.store.write }));
			} catch (error) {
				const detail = error instanceof Error ? error.message : String(error);
				// No account, one connected before calendar access, or a revoked grant: all mean connecting again.
				if (error instanceof NotSignedInError || error instanceof MissingScopesError || error instanceof GrantRevokedError) return reconnectRequired(detail);
				return fail('internal', error instanceof OAuthNetworkError ? 'google.offline' : 'google.syncFailed', { detail });
			}
		},
		account: async () => {
			const stored = await deps.store.read();
			return stored === null ? null : { email: stored.email };
		},
		connect: async () => {
			if (deps.client === null) return fail('internal', 'google.notConfigured');
			if (!(await deps.store.isAvailable())) return fail('internal', 'google.encryptionUnavailable');
			if (await isFullyConnected()) return fail('conflict', 'google.alreadyConnected');

			pending?.abort();
			const controller = new AbortController();
			pending = controller;
			try {
				return await signIn(deps.client, controller);
			} finally {
				if (pending === controller) pending = null;
			}
		},
		disconnect: async () => {
			const stored = await deps.store.read();
			if (stored === null) {
				// Nothing readable is left; drop whatever file remains.
				await deps.store.clear();
				return ok(null);
			}
			await revokeToken({ fetch: deps.fetch, token: stored.refreshToken }).catch((error: unknown) => console.error('Could not revoke the Google grant; deleting the tokens anyway', error));
			await deps.store.clear();
			return ok(null);
		},
	};
};
