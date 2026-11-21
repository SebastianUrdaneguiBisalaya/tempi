import { describe, expect, test } from 'bun:test';
import {
	authorizationUrl,
	createPkce,
	exchangeCode,
	GrantRevokedError,
	getAccessToken,
	MissingScopesError,
	NotSignedInError,
	type OAuthFetch,
	OAuthNetworkError,
	pkceChallenge,
	randomToken,
	refreshAccessToken,
	revokeToken,
	type StoredTokens,
} from './oauth';

const client = { id: 'client-id.apps.googleusercontent.com', secret: 'client-secret' };
const NOW = new Date('2026-11-16T10:00:00.000Z');

// Non-ASCII claims would need UTF-8 first; these are ASCII.
const jwt = (claims: object) => `header.${btoa(JSON.stringify(claims)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}.signature`;

/** Answers every request with `status` and `body`, recording what was sent. */
const fakeFetch = (status: number, body: unknown) => {
	const requests: { body: URLSearchParams; url: string }[] = [];
	const fetch: OAuthFetch = (url, init) => {
		requests.push({ body: init.body, url });
		return Promise.resolve({ json: () => Promise.resolve(body), ok: status >= 200 && status < 300, status });
	};
	return { fetch, requests };
};

/** A fetch that never answers on its own, only rejects when its request is aborted. */
const hanging: OAuthFetch = (_url, init) =>
	new Promise((_resolve, reject) => {
		init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
	});

const tokenBody = (claims: object | null = { aud: client.id, email: 'ada@example.com', sub: '42' }) => ({
	access_token: 'ya29.access',
	expires_in: 3599,
	...(claims === null ? {} : { id_token: jwt(claims) }),
	refresh_token: '1//refresh',
	scope: 'openid https://www.googleapis.com/auth/userinfo.email',
	token_type: 'Bearer',
});

describe('PKCE', () => {
	test('derives the S256 challenge (RFC 7636 appendix B)', async () => {
		expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
	});

	test('random tokens are long enough for a verifier and never repeat', () => {
		const a = randomToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(randomToken()).not.toBe(a);
	});

	test('a fresh pair matches its own challenge', async () => {
		const { challenge, verifier } = await createPkce();
		expect(challenge).toBe(await pkceChallenge(verifier));
	});
});

describe('authorization URL', () => {
	const request = { clientId: client.id, codeChallenge: 'challenge-1', redirectUri: 'http://127.0.0.1:5000', scopes: ['openid', 'email', 'https://example.com/a'], state: 'state-1' };

	test('carries the caller’s client, redirect, scopes and challenge', () => {
		const url = new URL(authorizationUrl(request));
		expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			client_id: client.id,
			code_challenge: 'challenge-1',
			code_challenge_method: 'S256',
			redirect_uri: 'http://127.0.0.1:5000',
			response_type: 'code',
			scope: 'openid email https://example.com/a',
			state: 'state-1',
		});
	});

	test('sends the options only when given', () => {
		const url = new URL(authorizationUrl({ ...request, accessType: 'offline', includeGrantedScopes: true, loginHint: 'ada@example.com', prompt: ['select_account', 'consent'] }));
		expect(Object.fromEntries(url.searchParams)).toMatchObject({ access_type: 'offline', include_granted_scopes: 'true', login_hint: 'ada@example.com', prompt: 'select_account consent' });
	});
});

describe('code exchange', () => {
	const grant = { client, code: 'auth-code', now: NOW, redirectUri: 'http://127.0.0.1:5000', verifier: 'verifier-1' };

	test('sends the code with its verifier and returns the tokens and who signed in', async () => {
		const { fetch, requests } = fakeFetch(200, tokenBody());
		expect(await exchangeCode({ ...grant, fetch })).toEqual({
			accessToken: 'ya29.access',
			account: { email: 'ada@example.com', subject: '42' },
			expiresAt: '2026-11-16T10:59:59.000Z',
			refreshToken: '1//refresh',
			scope: 'openid https://www.googleapis.com/auth/userinfo.email',
		});
		expect(requests[0]?.url).toBe('https://oauth2.googleapis.com/token');
		expect(Object.fromEntries(requests[0]?.body ?? [])).toEqual({
			client_id: client.id,
			client_secret: client.secret,
			code: 'auth-code',
			code_verifier: 'verifier-1',
			grant_type: 'authorization_code',
			redirect_uri: 'http://127.0.0.1:5000',
		});
	});

	test('without openid or a refresh token, those come back empty', async () => {
		const { refresh_token: _, ...withoutRefresh } = tokenBody(null);
		expect(await exchangeCode({ ...grant, fetch: fakeFetch(200, withoutRefresh).fetch })).toMatchObject({ account: null, refreshToken: null });
	});

	test('a client without a secret sends none', async () => {
		const { fetch, requests } = fakeFetch(200, tokenBody(null));
		await exchangeCode({ ...grant, client: { id: client.id }, fetch });
		expect(requests[0]?.body.has('client_secret')).toBe(false);
	});

	test('fails when Google refuses the code, or with an ID token for another client', async () => {
		await expect(exchangeCode({ ...grant, fetch: fakeFetch(400, { error: 'invalid_grant' }).fetch })).rejects.toThrow('invalid_grant');
		await expect(exchangeCode({ ...grant, fetch: fakeFetch(200, { access_token: 'a' }).fetch })).rejects.toThrow('Unexpected token response');
		await expect(exchangeCode({ ...grant, fetch: fakeFetch(200, tokenBody({ aud: 'someone-else', sub: '42' })).fetch })).rejects.toThrow('another client');
	});
});

describe('refreshing', () => {
	test('trades the refresh token for a new access token', async () => {
		const { fetch, requests } = fakeFetch(200, { access_token: 'ya29.new', expires_in: 3600, scope: 'openid' });
		expect(await refreshAccessToken({ client, fetch, now: NOW, refreshToken: '1//refresh' })).toEqual({ accessToken: 'ya29.new', expiresAt: '2026-11-16T11:00:00.000Z', scope: 'openid' });
		expect(Object.fromEntries(requests[0]?.body ?? [])).toMatchObject({ grant_type: 'refresh_token', refresh_token: '1//refresh' });
	});

	test('tells a revoked grant from other failures and from no connection', async () => {
		const refresh = (fetch: OAuthFetch) => refreshAccessToken({ client, fetch, now: NOW, refreshToken: 'r' });
		await expect(refresh(fakeFetch(400, { error: 'invalid_grant' }).fetch)).rejects.toBeInstanceOf(GrantRevokedError);
		await expect(refresh(fakeFetch(500, {}).fetch)).rejects.not.toBeInstanceOf(GrantRevokedError);
		await expect(refresh(() => Promise.reject(new Error('down')))).rejects.toBeInstanceOf(OAuthNetworkError);
	});

	test('a refresh Google never answers fails as unreachable at the deadline', async () => {
		await expect(refreshAccessToken({ client, fetch: hanging, now: NOW, refreshToken: 'r', timeoutMs: 10 })).rejects.toBeInstanceOf(OAuthNetworkError);
	});
});

describe('revoking', () => {
	test('posts the token to the revoke endpoint', async () => {
		const { fetch, requests } = fakeFetch(200, {});
		await revokeToken({ fetch, token: '1//refresh' });
		expect(requests).toEqual([{ body: new URLSearchParams({ token: '1//refresh' }), url: 'https://oauth2.googleapis.com/revoke' }]);
	});

	test('a token Google no longer knows counts as revoked; a server error does not', async () => {
		await revokeToken({ fetch: fakeFetch(400, { error: 'invalid_token' }).fetch, token: 'gone' });
		await expect(revokeToken({ fetch: fakeFetch(503, {}).fetch, token: '1//refresh' })).rejects.toThrow('503');
	});
});

describe('access token', () => {
	type Saved = StoredTokens & { email: string };
	const tokens: Saved = { accessToken: 'access', email: 'ada@example.com', expiresAt: '2026-11-16T11:00:00.000Z', refreshToken: 'refresh', scope: 'openid https://example.com/a' };

	const source = (stored: Saved | null, options: { fetch?: OAuthFetch; now?: string; marginMs?: number } = {}) => {
		const saved: Saved[] = [];
		const get = () =>
			getAccessToken({
				client,
				fetch: options.fetch ?? fakeFetch(200, { access_token: 'access-2', expires_in: 3600 }).fetch,
				load: () => Promise.resolve(stored),
				now: () => new Date(options.now ?? '2026-11-16T10:00:00.000Z'),
				refreshMarginMs: options.marginMs,
				requiredScopes: ['https://example.com/a'],
				save: next => {
					saved.push(next);
					return Promise.resolve();
				},
			});
		return { get, saved };
	};

	test('reuses the stored token until the margin before expiry', async () => {
		const fresh = source(tokens, { now: '2026-11-16T10:58:59.000Z' });
		expect(await fresh.get()).toBe('access');
		expect(fresh.saved).toEqual([]);
	});

	test('inside the margin, refreshes and saves the new token beside the caller’s own fields', async () => {
		const due = source(tokens, { now: '2026-11-16T10:59:30.000Z' });
		expect(await due.get()).toBe('access-2');
		expect(due.saved).toEqual([{ ...tokens, accessToken: 'access-2', expiresAt: '2026-11-16T11:59:30.000Z' }]);
	});

	test('the margin is configurable', async () => {
		expect(await source(tokens, { marginMs: 10 * 60_000, now: '2026-11-16T10:55:00.000Z' }).get()).toBe('access-2');
	});

	test('fails with nothing stored, or with a grant lacking a required scope', async () => {
		await expect(source(null).get()).rejects.toBeInstanceOf(NotSignedInError);
		const error = await source({ ...tokens, scope: 'openid' })
			.get()
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(MissingScopesError);
		expect((error as MissingScopesError).missing).toEqual(['https://example.com/a']);
	});

	test('passes on a revoked grant without saving', async () => {
		const revoked = source(tokens, { fetch: fakeFetch(400, { error: 'invalid_grant' }).fetch, now: '2026-11-16T12:00:00.000Z' });
		await expect(revoked.get()).rejects.toBeInstanceOf(GrantRevokedError);
		expect(revoked.saved).toEqual([]);
	});
});
