import { describe, expect, test } from 'bun:test';
import type { Result } from '@tempi/core';
import { speak } from './speak';

type Sent = { body: unknown; headers: Headers; url: string };

const mp3 = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0]);

/** ElevenLabs answering every request with `status` (audio on success, a JSON error otherwise), recording what it received. */
const elevenlabs = (status: number, audio: Uint8Array = mp3) => {
	const sent: Sent[] = [];
	const fake = async (input: Request | string | URL, init?: RequestInit) => {
		const request = input instanceof Request ? new Request(input, init) : new Request(String(input), init);
		sent.push({ body: await request.json(), headers: request.headers, url: request.url });
		if (status !== 200) return new Response(JSON.stringify({ detail: 'nope' }), { headers: { 'content-type': 'application/json' }, status });
		return new Response(audio, { headers: { 'content-type': 'audio/mpeg' }, status });
	};
	return { fetch: fake as typeof fetch, sent };
};

// Bun's `typeof fetch` also carries `preconnect`, which a stand-in doesn't need.
const offline = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;

const request = { model: 'eleven_multilingual_v2', text: 'Mañana tienes dentista a las 3.', voiceId: 'voice-es' };

const keyOf = (result: Result<unknown>) => (result.ok ? null : result.error.issues[0]?.key);

describe('speak', () => {
	test('reads the text with the chosen voice and model, and returns the audio', async () => {
		const fake = elevenlabs(200);
		expect(await speak('xi-key', request, fake)).toEqual({ ok: true, value: mp3 });

		const [sent] = fake.sent;
		expect(sent?.url).toContain('/v1/text-to-speech/voice-es');
		expect(sent?.url).toContain('output_format=mp3_44100_128');
		expect(sent?.headers.get('xi-api-key')).toBe('xi-key');
		expect(sent?.body).toMatchObject({ model_id: 'eleven_multilingual_v2', text: 'Mañana tienes dentista a las 3.' });
	});

	test('no audio back is ai.speechFailed', async () => {
		expect(keyOf(await speak('xi-key', request, elevenlabs(200, new Uint8Array())))).toBe('ai.speechFailed');
	});

	test.each([
		[401, 'ai.invalidKey'],
		[404, 'ai.speechFailed'],
		[422, 'ai.speechFailed'],
		[429, 'ai.rateLimited'],
		[500, 'ai.providerError'],
	] as const)('an answer of %i fails with %s', async (status, key) => {
		expect(keyOf(await speak('xi-key', request, elevenlabs(status)))).toBe(key);
	});

	test('ElevenLabs out of reach is ai.network, with the key out of the detail', async () => {
		const result = await speak('xi-secret', request, { fetch: offline });
		expect(keyOf(result)).toBe('ai.network');
		expect(JSON.stringify(result)).not.toContain('xi-secret');
	});
});
