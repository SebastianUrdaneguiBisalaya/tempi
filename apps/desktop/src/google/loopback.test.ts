import { describe, expect, test } from 'bun:test';
import { listenForRedirect } from './loopback';

const listen = (signal = new AbortController().signal, timeoutMs = 5000, state: () => string | null = () => 'state-1') =>
	listenForRedirect({ landingUrl: succeeded => `https://tempi.test/${succeeded ? 'signed-in' : 'sign-in-failed'}`, signal, state, timeoutMs });

describe('loopback redirect', () => {
	test('listens on 127.0.0.1 and takes the redirect with the expected state', async () => {
		const { outcome, redirectUri } = await listen();
		expect(redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
		const response = await fetch(`${redirectUri}/?state=state-1&code=abc`, { redirect: 'manual' });
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('https://tempi.test/signed-in');
		const ended = await outcome;
		expect(ended.kind === 'redirect' && ended.params.get('code')).toBe('abc');
	});

	test('rejects a redirect with another state and keeps waiting', async () => {
		const { outcome, redirectUri } = await listen();
		expect((await fetch(`${redirectUri}/?state=forged&code=evil`)).status).toBe(400);
		expect((await fetch(`${redirectUri}/favicon.ico`)).status).toBe(404);
		const denied = await fetch(`${redirectUri}/?state=state-1&error=access_denied`, { redirect: 'manual' });
		expect(denied.headers.get('location')).toBe('https://tempi.test/sign-in-failed');
		const ended = await outcome;
		expect(ended.kind === 'redirect' && ended.params.get('error')).toBe('access_denied');
	});

	test('rejects every redirect until the state exists', async () => {
		let state: string | null = null;
		const { outcome, redirectUri } = await listen(undefined, 5000, () => state);
		expect((await fetch(`${redirectUri}/?state=state-1&code=early`)).status).toBe(400);
		state = 'state-1';
		await fetch(`${redirectUri}/?state=state-1&code=abc`, { redirect: 'manual' });
		const ended = await outcome;
		expect(ended.kind === 'redirect' && ended.params.get('code')).toBe('abc');
	});

	test('stops listening once the wait ends', async () => {
		const { outcome, redirectUri } = await listen();
		await fetch(`${redirectUri}/?state=state-1&code=abc`, { redirect: 'manual' });
		await outcome;
		await expect(fetch(`${redirectUri}/?state=state-1&code=again`)).rejects.toThrow();
	});

	test('ends on timeout or abort', async () => {
		expect(await (await listen(undefined, 10)).outcome).toEqual({ kind: 'timeout' });
		const controller = new AbortController();
		const { outcome } = await listen(controller.signal);
		controller.abort();
		expect(await outcome).toEqual({ kind: 'aborted' });
	});
});
