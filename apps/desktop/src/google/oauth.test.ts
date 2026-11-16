import { describe, expect, test } from 'bun:test';
import { authorizationUrl, exchangeCode, type Fetch, oauthClientFrom, pkceChallenge, randomToken, revokeToken } from './oauth';

const client = { id: 'client-id.apps.googleusercontent.com', secret: 'client-secret' };
const NOW = new Date('2026-11-16T10:00:00.000Z');

const jwt = (claims: object) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

/** Answers every request with `status` and `body`, recording what was sent. */
const fakeFetch = (status: number, body: unknown) => {
	const requests: { body: URLSearchParams; url: string }[] = [];
	const fetch: Fetch = (url, init) => {
		requests.push({ body: init.body, url });
		return Promise.resolve({ json: () => Promise.resolve(body), ok: status >= 200 && status < 300, status });
	};
	return { fetch, requests };
};

const tokenBody = (claims: object = { aud: client.id, email: 'ada@example.com', sub: '42' }) => ({
	access_token: 'ya29.access',
	expires_in: 3599,
	id_token: jwt(claims),
	refresh_token: '1//refresh',
	scope: 'openid https://www.googleapis.com/auth/userinfo.email',
	token_type: 'Bearer',
});

describe('client config', () => {
	test('needs both the id and the secret', () => {
		expect(oauthClientFrom({ id: client.id, secret: client.secret })).toEqual(client);
		expect(oauthClientFrom({ id: client.id, secret: undefined })).toBeNull();
		expect(oauthClientFrom({ id: ' ', secret: client.secret })).toBeNull();
	});
});

describe('PKCE', () => {
	test('derives the S256 challenge (RFC 7636 appendix B)', () => {
		expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
	});

	test('random tokens are long enough for a verifier and never repeat', () => {
		const a = randomToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(randomToken()).not.toBe(a);
	});

	test('the authorization URL carries the challenge, never the verifier or the secret', () => {
		const url = new URL(authorizationUrl(client, { redirectUri: 'http://127.0.0.1:5000', state: 'state-1', verifier: 'verifier-1' }));
		expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			client_id: client.id,
			code_challenge: pkceChallenge('verifier-1'),
			code_challenge_method: 'S256',
			redirect_uri: 'http://127.0.0.1:5000',
			response_type: 'code',
			scope: 'openid email',
			state: 'state-1',
		});
		expect(url.toString()).not.toContain('verifier-1');
		expect(url.toString()).not.toContain(client.secret);
	});
});

describe('code exchange', () => {
	const grant = { code: 'auth-code', now: NOW, redirectUri: 'http://127.0.0.1:5000', verifier: 'verifier-1' };

	test('sends the code with its verifier and returns the tokens and who signed in', async () => {
		const { fetch, requests } = fakeFetch(200, tokenBody());
		expect(await exchangeCode(fetch, client, grant)).toEqual({
			accessToken: 'ya29.access',
			email: 'ada@example.com',
			expiresAt: '2026-11-16T10:59:59.000Z',
			refreshToken: '1//refresh',
			scope: 'openid https://www.googleapis.com/auth/userinfo.email',
			subject: '42',
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

	test('fails when Google refuses the code', () => {
		expect(exchangeCode(fakeFetch(400, { error: 'invalid_grant' }).fetch, client, grant)).rejects.toThrow('invalid_grant');
	});

	test('fails without a refresh token, or with an id token for another client', () => {
		const { refresh_token: _, ...withoutRefresh } = tokenBody();
		expect(exchangeCode(fakeFetch(200, withoutRefresh).fetch, client, grant)).rejects.toThrow('Unexpected token response');
		expect(exchangeCode(fakeFetch(200, tokenBody({ aud: 'someone-else', email: 'ada@example.com', sub: '42' })).fetch, client, grant)).rejects.toThrow('another client');
	});
});

describe('revoking', () => {
	test('posts the token to the revoke endpoint', async () => {
		const { fetch, requests } = fakeFetch(200, {});
		await revokeToken(fetch, '1//refresh');
		expect(requests).toEqual([{ body: new URLSearchParams({ token: '1//refresh' }), url: 'https://oauth2.googleapis.com/revoke' }]);
	});

	test('a token Google no longer knows counts as revoked; a server error does not', async () => {
		await revokeToken(fakeFetch(400, { error: 'invalid_token' }).fetch, 'gone');
		expect(revokeToken(fakeFetch(503, {}).fetch, '1//refresh')).rejects.toThrow('503');
	});
});
