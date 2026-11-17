import { describe, expect, test } from 'bun:test';
import type { Result } from '@tempi/core';
import { transcribe } from './transcribe';

type Sent = { headers: Headers; url: string; form: Awaited<ReturnType<Request['formData']>> | null; raw: string };

/** ElevenLabs answering every request with `status` and `body`, recording the multipart uploads it received. */
const elevenlabs = (status: number, body: unknown) => {
	const sent: Sent[] = [];
	const fake = async (input: Request | string | URL, init?: RequestInit) => {
		const request = input instanceof Request ? new Request(input, init) : new Request(String(input), init);
		const raw = await request.clone().text();
		const form = request.headers.get('content-type')?.startsWith('multipart/form-data') ? await request.formData() : null;
		sent.push({ form, headers: request.headers, raw, url: request.url });
		return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status });
	};
	return { fetch: fake as typeof fetch, sent };
};

// Bun's `typeof fetch` also carries `preconnect`, which a stand-in doesn't need.
const offline = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;

const audio = new Uint8Array([26, 69, 223, 163, 1, 2, 3]);
const request = { audio, language: 'es' as const, mimeType: 'audio/webm' as const, model: 'scribe_v2' };

const keyOf = (result: Result<unknown>) => (result.ok ? null : result.error.issues[0]?.key);

describe('transcribe', () => {
	test('uploads the audio with the chosen model and the app language as a hint, and returns the text', async () => {
		const fake = elevenlabs(200, { language_code: 'spa', language_probability: 0.98, text: ' Crea una reunión con Ana el viernes a las 10. ', words: [] });
		expect(await transcribe('xi-key', request, fake)).toEqual({ ok: true, value: 'Crea una reunión con Ana el viernes a las 10.' });

		const [sent] = fake.sent;
		expect(sent?.url).toContain('/v1/speech-to-text');
		expect(sent?.headers.get('xi-api-key')).toBe('xi-key');
		expect(sent?.form?.get('model_id')).toBe('scribe_v2');
		expect(sent?.form?.get('language_code')).toBe('es');
		const file = sent?.form?.get('file');
		// Read from the raw part: Bun's form parser guesses the type again from the file name.
		expect(sent?.raw).toContain('filename="dictation.webm"\r\nContent-Type: audio/webm');
		expect(file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : null).toEqual(audio);
	});

	test('nothing recognized is ai.transcriptionFailed', async () => {
		expect(keyOf(await transcribe('xi-key', request, elevenlabs(200, { language_code: 'spa', language_probability: 0.1, text: '   ', words: [] })))).toBe('ai.transcriptionFailed');
	});

	test.each([
		[401, 'ai.invalidKey'],
		[422, 'ai.transcriptionFailed'],
		[429, 'ai.rateLimited'],
		[500, 'ai.providerError'],
	] as const)('an answer of %i fails with %s', async (status, key) => {
		expect(keyOf(await transcribe('xi-key', request, elevenlabs(status, { detail: 'nope' })))).toBe(key);
	});

	test('ElevenLabs out of reach is ai.network, with the key out of the detail', async () => {
		const result = await transcribe('xi-secret', request, { fetch: offline });
		expect(keyOf(result)).toBe('ai.network');
		expect(JSON.stringify(result)).not.toContain('xi-secret');
	});
});
