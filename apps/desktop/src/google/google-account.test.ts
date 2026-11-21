import { beforeEach, describe, expect, test } from 'bun:test';
import type { OAuthFetch } from '@tempi/google-calendar';
import { createGoogleAccountService, type GoogleAccountDeps } from './google-account';
import type { LoopbackOptions, RedirectOutcome } from './loopback';
import { CALENDAR_SCOPES } from './oauth';
import type { StoredAccount, TokenStore } from './token-store';

const client = { id: 'client-id', secret: 'client-secret' };
const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;

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

const fetch: OAuthFetch = (url, init) => {
	requests.push(`${url} ${init.body.toString()}`);
	if (url.endsWith('/revoke')) {
		if (revokeStatus === 'offline') return Promise.reject(new Error('offline'));
		return Promise.resolve({ json: () => Promise.resolve({}), ok: revokeStatus === 200, status: revokeStatus });
	}
	if (init.body.get('grant_type') === 'refresh_token') {
		if (refreshAnswer === 'offline') return Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'));
		const answer = refreshAnswer === 200 ? { access_token: 'access-2', expires_in: 3600 } : { error: 'invalid_grant' };
		return Promise.resolve({ json: () => Promise.resolve(answer), ok: refreshAnswer === 200, status: refreshAnswer });
	}
	const body = { access_token: 'access', expires_in: 3600, id_token: jwt({ aud: client.id, email: 'ada@example.com', sub: '42' }), refresh_token: 'refresh', scope: FULL_SCOPE };
	return Promise.resolve({ json: () => Promise.resolve(body), ok: true, status: 200 });
};

const listen = (options: LoopbackOptions) => {
	const outcome = new Promise<RedirectOutcome>(resolve => {
		const ended = browser(options.state);
		if (ended !== null) resolve(ended);
		else options.signal.addEventListener('abort', () => resolve({ kind: 'aborted' }));
	});
	return Promise.resolve({ outcome, redirectUri: 'http://127.0.0.1:5000' });
};

const service = (overrides: Partial<GoogleAccountDeps> = {}) =>
	createGoogleAccountService({
		client,
		fetch,
		listen,
		now: () => new Date('2026-11-16T10:00:00.000Z'),
		openBrowser: url => {
			opened.push(url);
			return Promise.resolve();
		},
		landingUrl: () => 'https://example.com/',
		store,
		...overrides,
	});

const FULL_SCOPE = ['openid', 'email', ...CALENDAR_SCOPES].join(' ');

const redirect = (params: Record<string, string>): RedirectOutcome => ({ kind: 'redirect', params: new URLSearchParams(params) });

beforeEach(() => {
	stored = null;
	encryptionAvailable = true;
	requests = [];
	revokeStatus = 200;
	refreshAnswer = 200;
	opened = [];
	browser = state => redirect({ code: 'auth-code', state });
});

describe('connect', () => {
	test('signs in through the browser and stores the tokens', async () => {
		expect(await service().connect()).toEqual({ ok: true, value: { account: { email: 'ada@example.com' }, status: 'connected' } });
		expect(opened).toHaveLength(1);
		expect(opened[0]).toStartWith('https://accounts.google.com/');
		expect(stored).toMatchObject({ accessToken: 'access', email: 'ada@example.com', expiresAt: '2026-11-16T11:00:00.000Z', refreshToken: 'refresh', subject: '42' });
		expect(await service().account()).toEqual({ email: 'ada@example.com' });
	});

	test('asks Google for exactly the scopes the legal pages describe, with PKCE and never the secret', async () => {
		await service().connect();
		const url = new URL(opened[0] ?? '');
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			client_id: client.id,
			code_challenge_method: 'S256',
			include_granted_scopes: 'true',
			prompt: 'select_account consent',
			redirect_uri: 'http://127.0.0.1:5000',
			response_type: 'code',
			scope: 'openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events',
		});
		expect(url.searchParams.has('access_type')).toBe(false);
		expect(url.toString()).not.toContain(client.secret);
	});

	test('a grant without a refresh token or an email fails, storing nothing', async () => {
		const body = { access_token: 'access', expires_in: 3600, scope: FULL_SCOPE };
		const answering =
			(answer: object): OAuthFetch =>
			() =>
				Promise.resolve({ json: () => Promise.resolve(answer), ok: true, status: 200 });
		expect(await service({ fetch: answering({ ...body, id_token: jwt({ aud: client.id, email: 'ada@example.com', sub: '42' }) }) }).connect()).toMatchObject({
			error: { issues: [{ key: 'google.authFailed' }] },
			ok: false,
		});
		expect(await service({ fetch: answering({ ...body, id_token: jwt({ aud: client.id, sub: '42' }), refresh_token: 'refresh' }) }).connect()).toMatchObject({
			error: { issues: [{ key: 'google.authFailed' }] },
			ok: false,
		});
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
		const refusing: OAuthFetch = () => Promise.resolve({ json: () => Promise.resolve({ error: 'invalid_grant' }), ok: false, status: 400 });
		expect(await service({ fetch: refusing }).connect()).toMatchObject({ error: { issues: [{ key: 'google.authFailed' }] }, ok: false });
		expect(stored).toBeNull();
	});

	test('a new connect cancels one still waiting in the browser', async () => {
		browser = () => null;
		const google = service();
		const first = google.connect();
		await Promise.resolve();
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
		expect(await service().accessToken()).toEqual({ ok: true, value: 'access' });
		const later = service({ now: () => new Date('2026-11-16T10:59:30.000Z') });
		expect(await later.accessToken()).toEqual({ ok: true, value: 'access-2' });
		expect(stored).toMatchObject({ accessToken: 'access-2', expiresAt: '2026-11-16T11:59:30.000Z', refreshToken: 'refresh' });
	});

	test('a revoked grant asks to connect again; no connection is offline', async () => {
		const later = service({ now: () => new Date('2026-11-16T12:00:00.000Z') });
		refreshAnswer = 'offline';
		expect(await later.accessToken()).toMatchObject({ error: { issues: [{ key: 'google.offline' }] }, ok: false });
		refreshAnswer = 400;
		expect(await later.accessToken()).toMatchObject({ error: { issues: [{ key: 'google.reconnectRequired' }] }, ok: false });
	});

	test('an account connected before calendar access must connect again, which replaces its grant', async () => {
		if (stored === null) throw new Error('not connected');
		stored = { ...stored, scope: 'openid email' };
		expect(await service().accessToken()).toMatchObject({ error: { issues: [{ key: 'google.reconnectRequired' }] }, ok: false });
		expect(await service().connect()).toMatchObject({ ok: true, value: { status: 'connected' } });
		expect(stored?.scope).toBe(FULL_SCOPE);
	});

	test('no account means connecting first', async () => {
		stored = null;
		expect(await service().accessToken()).toMatchObject({ error: { issues: [{ key: 'google.reconnectRequired' }] }, ok: false });
	});
});
