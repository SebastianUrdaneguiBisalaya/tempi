import { z } from 'zod';
import { LANGUAGES } from './settings';

/** Longest dictation the panel records. */
export const MAX_DICTATION_SECONDS = 60;

/**
 * A minute of compressed speech is well under a megabyte; the bound leaves room for less efficient codecs (WAV on some
 * platforms) while refusing anything that can't be one dictation.
 */
export const MAX_DICTATION_BYTES = 10 * 1024 * 1024;

/** Audio formats `MediaRecorder` produces across Electron's platforms, without codec parameters. */
export const DICTATION_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'] as const;

export type DictationAudioType = (typeof DICTATION_AUDIO_TYPES)[number];

/** One recorded dictation to transcribe. `language` (the app's) hints the transcription. */
export const transcriptionInputSchema = z.object({
	audio: z
		.instanceof(Uint8Array)
		.refine(bytes => bytes.byteLength > 0, 'validation.required')
		.refine(bytes => bytes.byteLength <= MAX_DICTATION_BYTES, 'ai.recordingTooLong'),
	language: z.enum(LANGUAGES),
	mimeType: z.enum(DICTATION_AUDIO_TYPES),
});

export type TranscriptionInput = z.input<typeof transcriptionInputSchema>;

export const transcriptionSchema = z.object({ text: z.string() });

export type Transcription = z.output<typeof transcriptionSchema>;

/** The audio type `MediaRecorder` reports (`audio/webm;codecs=opus`) as one of the accepted ones, or null. */
export const dictationAudioType = (mimeType: string): DictationAudioType | null => {
	const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
	return DICTATION_AUDIO_TYPES.find(type => type === base) ?? null;
};
