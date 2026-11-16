import { describe, expect, test } from 'bun:test';
import { listenForRedirect, redirectPage } from './loopback';

const listen = (signal = new AbortController().signal, timeoutMs = 5000) => listenForRedirect({ page: succeeded => (succeeded ? 'done' : 'failed'), signal, state: 'state-1', timeoutMs });

describe('loopback redirect', () => {
	test('listens on 127.0.0.1 and takes the redirect with the expected state', async () => {
		const { outcome, redirectUri } = await listen();
		expect(redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
		const response = await fetch(`${redirectUri}/?state=state-1&code=abc`);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('done');
		const ended = await outcome;
		expect(ended.kind === 'redirect' && ended.params.get('code')).toBe('abc');
	});

	test('rejects a redirect with another state and keeps waiting', async () => {
		const { outcome, redirectUri } = await listen();
		expect((await fetch(`${redirectUri}/?state=forged&code=evil`)).status).toBe(400);
		expect((await fetch(`${redirectUri}/favicon.ico`)).status).toBe(404);
		await fetch(`${redirectUri}/?state=state-1&error=access_denied`);
		const ended = await outcome;
		expect(ended.kind === 'redirect' && ended.params.get('error')).toBe('access_denied');
	});

	test('stops listening once the wait ends', async () => {
		const { outcome, redirectUri } = await listen();
		await fetch(`${redirectUri}/?state=state-1&code=abc`);
		await outcome;
		expect(fetch(`${redirectUri}/?state=state-1&code=again`)).rejects.toThrow();
	});

	test('ends on timeout or abort', async () => {
		expect(await (await listen(undefined, 10)).outcome).toEqual({ kind: 'timeout' });
		const controller = new AbortController();
		const { outcome } = await listen(controller.signal);
		controller.abort();
		expect(await outcome).toEqual({ kind: 'aborted' });
	});

	test('the page escapes its text', () => {
		expect(redirectPage('<b>', 'a & "b"')).toContain('<title>&#60;b&#62;</title>');
		expect(redirectPage('t', 'a & "b"')).toContain('<p>a &#38; &#34;b&#34;</p>');
	});
});
