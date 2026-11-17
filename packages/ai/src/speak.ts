import { ElevenLabsClient, ElevenLabsError } from '@elevenlabs/elevenlabs-js';
import { fail, ok, type Result } from '@tempi/core';
import { networkFailure, statusFailure } from './failures';
import type { AiRequestOptions } from './voices';

export type SpeechRequest = {
	text: string;
	/** The ElevenLabs voice chosen for the app's language. */
	voiceId: string;
	/** The ElevenLabs text to speech model chosen in Settings. */
	model: string;
};

/** A spoken reply takes a few seconds to render; allow for slow connections without hanging forever. */
const SPEECH_TIMEOUT_SECONDS = 60;

/** MP3 at 44.1 kHz, ElevenLabs' default and decodable by Chromium on every platform. */
const OUTPUT_FORMAT = 'mp3_44100_128';

/** Reads `text` aloud with ElevenLabs. The audio comes back in memory and is never written to disk. */
export const speak = async (key: string, { model, text, voiceId }: SpeechRequest, options: AiRequestOptions = {}): Promise<Result<Uint8Array<ArrayBuffer>>> => {
	const client = new ElevenLabsClient({ apiKey: key, maxRetries: 1, timeoutInSeconds: SPEECH_TIMEOUT_SECONDS, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) });
	try {
		// No language code: most models refuse one and detect the language from the text.
		const stream = await client.textToSpeech.convert(voiceId, { modelId: model, outputFormat: OUTPUT_FORMAT, text });
		const audio = new Uint8Array(await new Response(stream).arrayBuffer());
		if (audio.byteLength === 0) return fail('internal', 'ai.speechFailed', { detail: 'ElevenLabs returned no audio' });
		return ok(audio);
	} catch (error) {
		if (error instanceof ElevenLabsError && error.statusCode !== undefined) {
			// The request itself was refused (unknown voice, text the model can't read), not the key or the quota.
			if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 422)
				return fail('validation', 'ai.speechFailed', { detail: `elevenlabs answered ${error.statusCode}: ${error.message}` });
			return statusFailure('elevenlabs', error.statusCode);
		}
		return networkFailure('elevenlabs', error);
	}
};
