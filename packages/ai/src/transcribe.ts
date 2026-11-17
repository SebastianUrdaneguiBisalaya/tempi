import { ElevenLabsClient, ElevenLabsError } from '@elevenlabs/elevenlabs-js';
import { type DictationAudioType, fail, type Language, ok, type Result } from '@tempi/core';
import { networkFailure, statusFailure } from './failures';
import type { AiRequestOptions } from './voices';

export type TranscriptionRequest = {
	audio: Uint8Array;
	mimeType: DictationAudioType;
	/** The ElevenLabs Scribe model chosen in Settings. */
	model: string;
	/** The app's language, as a hint; Scribe still detects another one if the user speaks it. */
	language: Language;
};

const EXTENSIONS = { 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm' } as const satisfies Record<DictationAudioType, string>;

/** A minute of audio takes Scribe a few seconds; allow for slow uploads without hanging forever. */
const TRANSCRIPTION_TIMEOUT_SECONDS = 60;

/** Transcribes one dictation with ElevenLabs. The audio is sent from memory and never written to disk. */
export const transcribe = async (key: string, { audio, language, mimeType, model }: TranscriptionRequest, options: AiRequestOptions = {}): Promise<Result<string>> => {
	const client = new ElevenLabsClient({ apiKey: key, maxRetries: 1, timeoutInSeconds: TRANSCRIPTION_TIMEOUT_SECONDS, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) });
	try {
		// Named with its type, which ElevenLabs reads to decode the audio; the SDK drops a Blob's own type.
		const file = { contentType: mimeType, data: audio, filename: `dictation.${EXTENSIONS[mimeType]}` };
		const response = await client.speechToText.convert({ file, languageCode: language, modelId: model, tagAudioEvents: false });
		const text = 'text' in response && typeof response.text === 'string' ? response.text.trim() : '';
		if (text === '') return fail('validation', 'ai.transcriptionFailed', { detail: 'ElevenLabs returned no text' });
		return ok(text);
	} catch (error) {
		if (error instanceof ElevenLabsError && error.statusCode !== undefined) {
			// The audio itself was refused (unreadable or unsupported), not the key or the quota.
			if (error.statusCode === 422) return fail('validation', 'ai.transcriptionFailed', { detail: `elevenlabs answered 422: ${error.message}` });
			return statusFailure('elevenlabs', error.statusCode);
		}
		return networkFailure('elevenlabs', error);
	}
};
