import { ElevenLabsClient, ElevenLabsError } from '@elevenlabs/elevenlabs-js';
import { type AiVoice, ok, type Result } from '@tempi/core';
import { networkFailure, REQUEST_TIMEOUT_MS, statusFailure } from './failures';

export type AiRequestOptions = {
	/** Stands in for the global `fetch` (tests). */
	fetch?: typeof fetch;
};

// v2 search returns at most 100 voices a page; a few pages cover any account while keeping the settings screen quick.
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

/**
 * The voices the ElevenLabs account behind `key` can use, sorted by name. Also proves the key works. Uses v2 search:
 * v1's list answers with every voice and all its settings at once, which on a large account is slow enough to time out.
 */
export const listVoices = async (key: string, options: AiRequestOptions = {}): Promise<Result<AiVoice[]>> => {
	// The settings screen waits on this: fail fast instead of the SDK's retries.
	const client = new ElevenLabsClient({ apiKey: key, maxRetries: 0, timeoutInSeconds: REQUEST_TIMEOUT_MS / 1000, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) });
	try {
		const voices: AiVoice[] = [];
		let nextPageToken: string | undefined;
		for (let page = 0; page < MAX_PAGES; page++) {
			const answer = await client.voices.search({ includeTotalCount: false, pageSize: PAGE_SIZE, ...(nextPageToken === undefined ? {} : { nextPageToken }) });
			voices.push(...answer.voices.map(voice => ({ id: voice.voiceId, name: voice.name ?? voice.voiceId })));
			if (!answer.hasMore || answer.nextPageToken == null) break;
			nextPageToken = answer.nextPageToken;
		}
		return ok(voices.sort((a, b) => a.name.localeCompare(b.name)));
	} catch (error) {
		// The SDK reports a request that got no answer as an error without a status.
		if (error instanceof ElevenLabsError && error.statusCode !== undefined) return statusFailure('elevenlabs', error.statusCode);
		return networkFailure('elevenlabs', error);
	}
};
