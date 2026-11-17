import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { CSP_HEADER, developmentCsp, inlineScriptHashes, productionCsp, withCsp } from './csp';

const hashOf = (body: string) => `sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`;
const HASH = hashOf('self.__next_f.push([0])');

const directives = (policy: string) => new Map(policy.split('; ').map(part => [part.split(' ')[0], part.split(' ').slice(1)] as const));

describe('production policy', () => {
	const policy = productionCsp([HASH, HASH]);
	const scripts = directives(policy).get('script-src') ?? [];

	test('runs scripts only from the app origin and the hashed inline scripts', () => {
		expect(scripts).toEqual(["'self'", `'${HASH}'`]);
	});

	test('never allows eval or unhashed inline scripts', () => {
		expect(policy).not.toContain('unsafe-eval');
		expect(scripts).not.toContain("'unsafe-inline'");
	});

	test('carries none of the dev-only sources', () => {
		expect(policy).not.toContain('ws:');
		expect(policy).not.toContain('wss:');
		expect(policy).not.toContain('localhost');
		expect(policy).not.toContain('http');
	});

	test('locks down plugins, framing, <base> and forms', () => {
		const parsed = directives(policy);
		for (const name of ['object-src', 'base-uri', 'frame-ancestors', 'form-action', 'frame-src', 'worker-src']) expect(parsed.get(name)).toEqual(["'none'"]);
		expect(parsed.get('default-src')).toEqual(["'self'"]);
		expect(parsed.get('connect-src')).toEqual(["'self'"]);
	});

	test('allows stored avatars and the avatar preview as images', () => {
		expect(directives(policy).get('img-src')).toEqual(["'self'", 'blob:', 'tempi-avatar:']);
	});

	test('with no hashes, blocks every inline script', () => {
		expect(directives(productionCsp([])).get('script-src')).toEqual(["'self'"]);
	});

	test('rejects anything that is not a sha256 hash', () => {
		expect(() => productionCsp(["'unsafe-inline'"])).toThrow();
		expect(() => productionCsp(['sha256-abc'])).toThrow();
	});
});

describe('development policy', () => {
	test('allows what next dev needs: eval, inline scripts and its HMR websocket', () => {
		const parsed = directives(developmentCsp('http://localhost:3000'));
		expect(parsed.get('script-src')).toEqual(["'self'", "'unsafe-eval'", "'unsafe-inline'"]);
		expect(parsed.get('connect-src')).toEqual(["'self'", 'ws://localhost:3000']);
		expect(parsed.get('object-src')).toEqual(["'none'"]);
	});

	test('uses a secure websocket for an https dev server', () => {
		expect(directives(developmentCsp('https://tempi.test:8443')).get('connect-src')).toEqual(["'self'", 'wss://tempi.test:8443']);
	});
});

describe('inline script hashes', () => {
	test('hash inline scripts and skip external and empty ones', () => {
		const html = `<script src="/_next/a.js" async=""></script><script id="_R_">self.__next_f.push([0])</script><script></script><SCRIPT type="module">go()</SCRIPT >`;
		expect(inlineScriptHashes(html)).toEqual([HASH, hashOf('go()')]);
	});

	test('do not mistake data-src for src', () => {
		expect(inlineScriptHashes('<script data-src="x">run()</script>')).toEqual([hashOf('run()')]);
	});
});

describe('response headers', () => {
	test('replace any existing policy, whatever its case, and keep the rest', () => {
		const headers = withCsp({ 'content-security-policy': ['script-src *'], 'Content-Type': ['text/html'] }, "default-src 'self'");
		expect(headers).toEqual({ [CSP_HEADER]: ["default-src 'self'"], 'Content-Type': ['text/html'] });
	});
});
