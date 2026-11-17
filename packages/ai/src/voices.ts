import { ElevenLabsClient, ElevenLabsError } from '@elevenlabs/elevenlabs-js';
import { type AiVoice, ok, type Result } from '@tempi/core';
import { networkFailure, REQUEST_TIMEOUT_MS, statusFailure } from './failures';

export type AiRequestOptions = {
	/** Stands in for the global `fetch` (tests). */
	fetch?: typeof fetch;
};

/** The voices the ElevenLabs account behind `key` can use, sorted by name. Also proves the key works. */
export const listVoices = async (key: string, options: AiRequestOptions = {}): Promise<Result<AiVoice[]>> => {
	// The settings screen waits on this: fail fast instead of the SDK's retries.
	const client = new ElevenLabsClient({ apiKey: key, maxRetries: 0, timeoutInSeconds: REQUEST_TIMEOUT_MS / 1000, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) });
	try {
		const { voices } = await client.voices.getAll();
		return ok(voices.map(voice => ({ id: voice.voiceId, name: voice.name ?? voice.voiceId })).sort((a, b) => a.name.localeCompare(b.name)));
	} catch (error) {
		// The SDK reports a request that got no answer as an error without a status.
		if (error instanceof ElevenLabsError && error.statusCode !== undefined) return statusFailure('elevenlabs', error.statusCode);
		return networkFailure('elevenlabs', error);
	}
};
