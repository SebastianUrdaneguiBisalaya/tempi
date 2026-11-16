import { fail, type GoogleAccount, type GoogleConnectResult, ok, type Result } from '@tempi/core';
import type { LoopbackOptions, LoopbackRedirect } from './loopback';
import { authorizationUrl, exchangeCode, type Fetch, type GrantedTokens, type OAuthClient, randomToken, revokeToken } from './oauth';
import type { TokenStore } from './token-store';

/** How long the browser sign-in may take before connecting gives up. */
export const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

export type GoogleAccountDeps = {
	/** Null when this build has no OAuth client: every call that needs Google fails with `google.notConfigured`. */
	client: OAuthClient | null;
	store: TokenStore;
	fetch: Fetch;
	listen: (options: LoopbackOptions) => Promise<LoopbackRedirect>;
	/** Opens the sign-in page in the system browser, never inside the app. */
	openBrowser: (url: string) => Promise<void>;
	/** The browser page shown once Google redirects back. */
	page: (succeeded: boolean) => string;
	now: () => Date;
};

export type GoogleAccountService = {
	account: () => Promise<GoogleAccount | null>;
	/** OAuth 2.0 with PKCE through the system browser and a loopback redirect. Only one account can be connected. */
	connect: () => Promise<Result<GoogleConnectResult>>;
	/** Revokes the grant at Google and deletes the tokens. Offline, the tokens are deleted anyway and the failure logged. */
	disconnect: () => Promise<Result<null>>;
};

const authFailed = (detail: string) => fail<GoogleConnectResult>('internal', 'google.authFailed', { detail });

export const createGoogleAccountService = (deps: GoogleAccountDeps): GoogleAccountService => {
	// A second connect replaces a sign-in still waiting in the browser, which then ends as canceled.
	let pending: AbortController | null = null;

	const signIn = async (client: OAuthClient, controller: AbortController): Promise<Result<GoogleConnectResult>> => {
		const { signal } = controller;
		const state = randomToken();
		const verifier = randomToken();
		const { outcome, redirectUri } = await deps.listen({ page: deps.page, signal, state, timeoutMs: SIGN_IN_TIMEOUT_MS });
		try {
			await deps.openBrowser(authorizationUrl(client, { redirectUri, state, verifier }));
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

		let tokens: GrantedTokens;
		try {
			tokens = await exchangeCode(deps.fetch, client, { code, now: deps.now(), redirectUri, verifier });
		} catch (error) {
			return authFailed(error instanceof Error ? error.message : String(error));
		}
		// Another connect may have finished first while this one exchanged its code.
		if (signal.aborted || (await deps.store.read()) !== null) {
			await revokeToken(deps.fetch, tokens.refreshToken).catch((error: unknown) => console.error('Could not revoke an unused Google grant', error));
			return signal.aborted ? ok({ status: 'canceled' }) : fail('conflict', 'google.alreadyConnected');
		}
		await deps.store.write(tokens);
		return ok({ account: { email: tokens.email }, status: 'connected' });
	};

	return {
		account: async () => {
			const stored = await deps.store.read();
			return stored === null ? null : { email: stored.email };
		},
		connect: async () => {
			if (deps.client === null) return fail('internal', 'google.notConfigured');
			if (!deps.store.isAvailable()) return fail('internal', 'google.encryptionUnavailable');
			if ((await deps.store.read()) !== null) return fail('conflict', 'google.alreadyConnected');

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
			await revokeToken(deps.fetch, stored.refreshToken).catch((error: unknown) => console.error('Could not revoke the Google grant; deleting the tokens anyway', error));
			await deps.store.clear();
			return ok(null);
		},
	};
};
