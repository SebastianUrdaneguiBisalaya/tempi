import { describe, expect, test } from 'bun:test';
import type { AiProvider, Result } from '@tempi/core';
import { testKey } from './test-key';
import { listVoices } from './voices';

type Seen = { headers: Headers; url: string };

/** A provider that answers every request with `status` (and `body`), recording what it was sent. */
const provider = (status: number, body: unknown = {}) => {
	const seen: Seen[] = [];
	const fake = (input: Request | string | URL, init?: RequestInit) => {
		const request = input instanceof Request ? new Request(input, init) : new Request(String(input), init);
		seen.push({ headers: request.headers, url: request.url });
		return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status }));
	};
	return { fetch: fake as typeof fetch, seen };
};

// Bun's `typeof fetch` also carries `preconnect`, which a stand-in doesn't need.
const offline = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;

const keyOf = (result: Result<unknown>) => (result.ok ? null : result.error.issues[0]?.key);

const TEXT_PROVIDERS = [
	['openai', 'https://api.openai.com/v1/models', 'authorization', 'Bearer sk-test'],
	['anthropic', 'https://api.anthropic.com/v1/models', 'x-api-key', 'sk-test'],
	['google', 'https://generativelanguage.googleapis.com/v1beta/models', 'x-goog-api-key', 'sk-test'],
	['xai', 'https://api.x.ai/v1/models', 'authorization', 'Bearer sk-test'],
	['groq', 'https://api.groq.com/openai/v1/models', 'authorization', 'Bearer sk-test'],
] as const;

describe('testKey', () => {
	test.each(TEXT_PROVIDERS)('%s: lists the models with the key, which spends no tokens', async (name, url, header, value) => {
		const fake = provider(200, { data: [] });
		expect(await testKey(name, 'sk-test', fake)).toEqual({ ok: true, value: null });
		expect(fake.seen.map(request => request.url)).toEqual([url]);
		expect(fake.seen[0]?.headers.get(header)).toBe(value);
	});

	test.each([
		[400, 'ai.invalidKey'],
		[401, 'ai.invalidKey'],
		[403, 'ai.invalidKey'],
		[429, 'ai.rateLimited'],
		[500, 'ai.providerError'],
	] as const)('an answer of %i fails with %s', async (status, key) => {
		expect(keyOf(await testKey('openai', 'sk-test', provider(status)))).toBe(key);
	});

	test('a provider that cannot be reached fails with ai.network, and the key stays out of the detail', async () => {
		const result = await testKey('anthropic', 'sk-secret', { fetch: offline });
		expect(keyOf(result)).toBe('ai.network');
		expect(JSON.stringify(result)).not.toContain('sk-secret');
	});

	test('ElevenLabs keys are checked by listing voices', async () => {
		const fake = provider(200, { voices: [] });
		expect(await testKey('elevenlabs', 'xi-test', fake)).toEqual({ ok: true, value: null });
		expect(fake.seen[0]?.url).toContain('api.elevenlabs.io');
		expect(fake.seen[0]?.headers.get('xi-api-key')).toBe('xi-test');
	});

	test.each(['openai', 'elevenlabs'] as const satisfies AiProvider[])('%s: a rejected key is ai.invalidKey', async name => {
		expect(keyOf(await testKey(name, 'bad', provider(401, { detail: 'invalid_api_key' })))).toBe('ai.invalidKey');
	});
});

describe('listVoices', () => {
	test('returns the account’s voices by name', async () => {
		const fake = provider(200, {
			voices: [
				{ name: 'Sofía', voice_id: 'v-es' },
				{ name: 'Adam', voice_id: 'v-en' },
			],
		});
		expect(await listVoices('xi-test', fake)).toEqual({
			ok: true,
			value: [
				{ id: 'v-en', name: 'Adam' },
				{ id: 'v-es', name: 'Sofía' },
			],
		});
	});

	test('maps failures like a key test', async () => {
		expect(keyOf(await listVoices('xi-test', provider(429)))).toBe('ai.rateLimited');
		expect(keyOf(await listVoices('xi-test', { fetch: offline }))).toBe('ai.network');
	});
});
