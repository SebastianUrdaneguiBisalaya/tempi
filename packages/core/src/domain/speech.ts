import { z } from 'zod';
import { LANGUAGES } from './settings';

/**
 * Longest text read aloud at once. Spoken replies are short; the bound stays under what every ElevenLabs text to
 * speech model accepts in one request (Eleven v3 takes the fewest characters).
 */
export const MAX_SPEECH_LENGTH = 5000;

/** The audio ElevenLabs answers with: MP3, which Chromium decodes everywhere. */
export const SPEECH_AUDIO_TYPE = 'audio/mpeg';

/** Text to read aloud in the voice chosen for `language` (the app's). */
export const speechInputSchema = z.object({
	language: z.enum(LANGUAGES),
	text: z.string().trim().min(1, 'validation.required').max(MAX_SPEECH_LENGTH, 'validation.max'),
});

export type SpeechInput = z.input<typeof speechInputSchema>;

/** The spoken audio, kept in memory only. */
export const speechSchema = z.object({
	audio: z.instanceof(Uint8Array).refine(bytes => bytes.byteLength > 0, 'validation.required'),
	mimeType: z.literal(SPEECH_AUDIO_TYPE),
});

export type Speech = z.output<typeof speechSchema>;
