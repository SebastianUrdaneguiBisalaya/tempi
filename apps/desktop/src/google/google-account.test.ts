import { beforeEach, describe, expect, test } from 'bun:test';
import { createGoogleAccountService, type GoogleAccountDeps } from './google-account';
import type { LoopbackOptions, RedirectOutcome } from './loopback';
import type { Fetch } from './oauth';
import type { StoredAccount, TokenStore } from './token-store';

const client = { id: 'client-id', secret: 'client-secret' };
const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;

let stored: StoredAccount | null;
let encryptionAvailable: boolean;
let requests: string[];
let revokeStatus: number | 'offline';
let opened: string[];
/** How the browser step ends, given the `state` the listener expects (null: the user never comes back). */
let browser: (state: string) => RedirectOutcome | null;

const store: TokenStore = {
	clear: () => {
		stored = null;
		return Promise.resolve();
	},
	isAvailable: () => encryptionAvailable,
	read: () => Promise.resolve(stored),
	write: account => {
		stored = account;
		return Promise.resolve();
	},
};

const fetch: Fetch = (url, init) => {
	requests.push(`${url} ${init.body.toString()}`);
	if (url.endsWith('/revoke')) {
		if (revokeStatus === 'offline') return Promise.reject(new Error('offline'));
		return Promise.resolve({ json: () => Promise.resolve({}), ok: revokeStatus === 200, status: revokeStatus });
	}
	const body = { access_token: 'access', expires_in: 3600, id_token: jwt({ aud: client.id, email: 'ada@example.com', sub: '42' }), refresh_token: 'refresh', scope: 'openid email' };
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
		page: () => '',
		store,
		...overrides,
	});

const redirect = (params: Record<string, string>): RedirectOutcome => ({ kind: 'redirect', params: new URLSearchParams(params) });

beforeEach(() => {
	stored = null;
	encryptionAvailable = true;
	requests = [];
	revokeStatus = 200;
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
		const refusing: Fetch = () => Promise.resolve({ json: () => Promise.resolve({ error: 'invalid_grant' }), ok: false, status: 400 });
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
