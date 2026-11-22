import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import type { FetchLike } from '@usemeshly/auth';
import { createGoogleAccountService, type GoogleAccountDeps } from './google-account';
import type { LoopbackOptions, RedirectOutcome } from './loopback';
import { CALENDAR_SCOPES } from './oauth';
import type { StoredAccount, TokenStore } from './token-store';

const client = { clientId: 'client-id', clientSecret: 'client-secret' };
const NOW = new Date('2026-11-16T10:00:00.000Z');

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
/** An ID token as Google's token endpoint sends it; the library checks its claims, not its signature. */
const idToken = (claims: object) => `${base64Url({ alg: 'RS256', typ: 'JWT' })}.${base64Url(claims)}.signature`;

let stored: StoredAccount | null;
let encryptionAvailable: boolean;
let requests: string[];
let revokeStatus: number | 'offline';
/** How Google answers a refresh: a status, or no connection at all. */
let refreshAnswer: number | 'offline';
let opened: string[];
/** How the browser step ends, given the `state` the listener expects (null: the user never comes back). */
let browser: (state: string) => RedirectOutcome | null;

const store: TokenStore = {
	clear: () => {
		stored = null;
		return Promise.resolve();
	},
	isAvailable: () => Promise.resolve(encryptionAvailable),
	read: () => Promise.resolve(stored),
	write: account => {
		stored = account;
		return Promise.resolve();
	},
};

const FULL_SCOPE = ['openid', 'email', ...CALENDAR_SCOPES].join(' ');

const json = (body: object, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status }));

/** The claims Google signs for the sign-in the browser just opened, with its nonce. */
const claimsFor = (extra: object = {}) => {
	const nonce = new URL(opened.at(-1) ?? 'https://x.test').searchParams.get('nonce');
	const iat = Math.floor(Date.now() / 1000);
	return { aud: client.clientId, email: 'ada@example.com', exp: iat + 3600, iat, iss: 'https://accounts.google.com', nonce, sub: '42', ...extra };
};

const codeGrant = (extra: object = {}) => ({ access_token: 'access', expires_in: 3600, id_token: idToken(claimsFor()), refresh_token: 'refresh', scope: FULL_SCOPE, token_type: 'Bearer', ...extra });

const fetch: FetchLike = (url, init) => {
	const body = new URLSearchParams(String(init.body));
	requests.push(`${url} token=${body.get('token') ?? ''}`);
	if (url.endsWith('/revoke')) {
		if (revokeStatus === 'offline') return Promise.reject(new TypeError('offline'));
		return json({}, revokeStatus);
	}
	if (body.get('grant_type') === 'refresh_token') {
		if (refreshAnswer === 'offline') return Promise.reject(new TypeError('net::ERR_INTERNET_DISCONNECTED'));
		return refreshAnswer === 200 ? json({ access_token: 'access-2', expires_in: 3600, token_type: 'Bearer' }) : json({ error: 'invalid_grant' }, refreshAnswer);
	}
	return json(codeGrant());
};

/** Ends the browser step of the sign-in being waited on; the browser comes back only once its page opened. */
let comeBack: () => void = () => undefined;

const listen = (options: LoopbackOptions) => {
	const outcome = new Promise<RedirectOutcome>(resolve => {
		options.signal.addEventListener('abort', () => resolve({ kind: 'aborted' }));
		comeBack = () => {
			const ended = browser(options.state() ?? '');
			if (ended !== null) resolve(ended);
		};
	});
	return Promise.resolve({ outcome, redirectUri: 'http://127.0.0.1:5000' });
};

const service = (overrides: Partial<GoogleAccountDeps> = {}) =>
	createGoogleAccountService({
		client,
		fetch,
		landingUrl: () => 'https://example.com/',
		listen,
		openBrowser: url => {
			opened.push(url);
			queueMicrotask(comeBack);
			return Promise.resolve();
		},
		store,
		...overrides,
	});

const redirect = (params: Record<string, string>): RedirectOutcome => ({ kind: 'redirect', params: new URLSearchParams(params) });

const errorCode = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(error: unknown) => (error instanceof Error && 'code' in error ? error.code : 'not a MeshlyError')
	);

beforeEach(() => {
	setSystemTime(NOW);
	stored = null;
	encryptionAvailable = true;
	requests = [];
	revokeStatus = 200;
	refreshAnswer = 200;
	opened = [];
	browser = state => redirect({ code: 'auth-code', state });
});

afterEach(() => setSystemTime());

describe('connect', () => {
	test('signs in through the browser and stores the tokens', async () => {
		expect(await service().connect()).toEqual({ ok: true, value: { account: { email: 'ada@example.com' }, status: 'connected' } });
		expect(opened).toHaveLength(1);
		expect(opened[0]).toStartWith('https://accounts.google.com/');
		expect(stored).toEqual({ accessToken: 'access', email: 'ada@example.com', expiresAt: '2026-11-16T11:00:00.000Z', refreshToken: 'refresh', scope: FULL_SCOPE, subject: '42' });
		expect(await service().account()).toEqual({ email: 'ada@example.com' });
	});

	test('asks Google for exactly the scopes the legal pages describe, with PKCE and never the secret', async () => {
		await service().connect();
		const url = new URL(opened[0] ?? '');
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			access_type: 'offline',
			client_id: client.clientId,
			code_challenge_method: 'S256',
			include_granted_scopes: 'true',
			prompt: 'select_account consent',
			redirect_uri: 'http://127.0.0.1:5000',
			response_type: 'code',
			scope: 'openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events',
		});
		expect(url.searchParams.get('code_challenge')).toBeTruthy();
		expect(url.toString()).not.toContain(client.clientSecret);
	});

	test('a grant without a refresh token or an email fails, storing nothing', async () => {
		const answering =
			(extra: () => object): FetchLike =>
			() =>
				json(codeGrant(extra()));
		expect(await service({ fetch: answering(() => ({ refresh_token: undefined })) }).connect()).toMatchObject({ error: { issues: [{ key: 'google.authFailed' }] }, ok: false });
		expect(await service({ fetch: answering(() => ({ id_token: idToken(claimsFor({ email: undefined })) })) }).connect()).toMatchObject({
			error: { issues: [{ key: 'google.authFailed' }] },
			ok: false,
		});
		expect(stored).toBeNull();
	});

	test('an ID token for another sign-in (wrong nonce) fails, storing nothing', async () => {
		const replayed: FetchLike = () => json(codeGrant({ id_token: idToken(claimsFor({ nonce: 'someone-else' })) }));
		expect(await service({ fetch: replayed }).connect()).toMatchObject({ error: { issues: [{ key: 'google.authFailed' }] }, ok: false });
		expect(stored).toBeNull();
	});

	test('a redirect with another state fails before the code is exchanged', async () => {
		browser = () => redirect({ code: 'auth-code', state: 'forged' });
		expect(await service().connect()).toMatchObject({ error: { issues: [{ key: 'google.authFailed' }] }, ok: false });
		expect(requests).toEqual([]);
		expect(stored).toBeNull();
	});

	test('only one account: a second connect fails without opening the browser', async () => {
		const google = service();
		await google.connect();
		expect(await google.connect()).toMatchObject({ error: { code: 'conflict', issues: [{ key: 'google.alreadyConnected' }] }, ok: false });
		expect(opened).toHaveLength(1);
	});

	test('declining in the browser is a cancel, and stores nothing', async () => {
		browser = state => redirect({ error: 'access_denied', state });
		expect(await service().connect()).toEqual({ ok: true, value: { status: 'canceled' } });
		expect(stored).toBeNull();
	});

	test('a timeout or an exchange Google refuses fails, storing nothing', async () => {
		browser = () => ({ kind: 'timeout' });
		expect(await service().connect()).toMatchObject({ error: { issues: [{ key: 'google.timeout' }] }, ok: false });
		browser = state => redirect({ code: 'auth-code', state });
		const refusing: FetchLike = () => json({ error: 'invalid_grant' }, 400);
		expect(await service({ fetch: refusing }).connect()).toMatchObject({ error: { issues: [{ key: 'google.authFailed' }] }, ok: false });
		expect(stored).toBeNull();
	});

	test('a new connect cancels one still waiting in the browser', async () => {
		browser = () => null;
		const google = service();
		const first = google.connect();
		await new Promise(resolve => setTimeout(resolve, 0));
		browser = state => redirect({ code: 'auth-code', state });
		const second = google.connect();
		expect(await first).toEqual({ ok: true, value: { status: 'canceled' } });
		expect(await second).toMatchObject({ ok: true, value: { status: 'connected' } });
	});

	test('fails without an OAuth client or without encryption', async () => {
		expect(await service({ client: null }).connect()).toMatchObject({ error: { issues: [{ key: 'google.notConfigured' }] }, ok: false });
		encryptionAvailable = false;
		expect(await service().connect()).toMatchObject({ error: { issues: [{ key: 'google.encryptionUnavailable' }] }, ok: false });
		expect(opened).toEqual([]);
	});
});

describe('disconnect', () => {
	beforeEach(() => service().connect());

	test('revokes the refresh token and deletes the tokens', async () => {
		requests = [];
		expect(await service().disconnect()).toEqual({ ok: true, value: null });
		expect(requests).toEqual(['https://oauth2.googleapis.com/revoke token=refresh']);
		expect(stored).toBeNull();
		expect(await service().account()).toBeNull();
	});

	test('still deletes the tokens when Google cannot be reached', async () => {
		revokeStatus = 'offline';
		expect(await service().disconnect()).toEqual({ ok: true, value: null });
		expect(stored).toBeNull();
	});
});

describe('access token', () => {
	beforeEach(() => service().connect());

	test('is reused until it is about to expire, then refreshed and kept', async () => {
		expect(await service().getAccessToken()).toBe('access');
		setSystemTime(new Date('2026-11-16T10:59:30.000Z'));
		expect(await service().getAccessToken()).toBe('access-2');
		expect(stored).toEqual({ accessToken: 'access-2', email: 'ada@example.com', expiresAt: '2026-11-16T11:59:30.000Z', refreshToken: 'refresh', scope: FULL_SCOPE, subject: '42' });
	});

	test('no connection is offline; a revoked grant asks to connect again', async () => {
		setSystemTime(new Date('2026-11-16T12:00:00.000Z'));
		refreshAnswer = 'offline';
		expect(await errorCode(service().getAccessToken())).toBe('network_error');
		refreshAnswer = 400;
		expect(await errorCode(service().getAccessToken())).toBe('invalid_grant');
	});

	test('an account connected before calendar access must connect again, which replaces its grant', async () => {
		if (stored === null) throw new Error('not connected');
		stored = { ...stored, scope: 'openid email' };
		expect(await errorCode(service().getAccessToken())).toBe('missing_scopes');
		expect(await service().connect()).toMatchObject({ ok: true, value: { status: 'connected' } });
		expect(stored?.scope).toBe(FULL_SCOPE);
	});

	test('no account means connecting first', async () => {
		stored = null;
		expect(await errorCode(service().getAccessToken())).toBe('not_signed_in');
	});
});
