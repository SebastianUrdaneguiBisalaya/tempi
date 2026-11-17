import { readFile, rename, writeFile } from 'node:fs/promises';
import { type AiSettingsValues, aiSettingsValuesSchema, DEFAULT_AI_SETTINGS } from '@tempi/core';

/** The AI choices (models, voices). They hold no secret, so they are plain JSON next to the database. */
export type AiSettingsStore = {
	/** The saved settings, or the defaults when none are saved or the file is unreadable. */
	read: () => Promise<AiSettingsValues>;
	write: (settings: AiSettingsValues) => Promise<void>;
};

const isMissing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';

export const createAiSettingsStore = (file: string): AiSettingsStore => ({
	read: async () => {
		let text: string;
		try {
			text = await readFile(file, 'utf8');
		} catch (error) {
			if (isMissing(error)) return DEFAULT_AI_SETTINGS;
			throw error;
		}
		try {
			const parsed = aiSettingsValuesSchema.safeParse(JSON.parse(text));
			// A model dropped from a list in a newer version makes the file invalid: start over from the defaults.
			if (parsed.success) return parsed.data;
			console.error('The stored AI settings are invalid; using the defaults', parsed.error.message);
		} catch (error) {
			console.error('The stored AI settings could not be read; using the defaults', error);
		}
		return DEFAULT_AI_SETTINGS;
	},
	write: async settings => {
		const staged = `${file}.tmp`;
		await writeFile(staged, JSON.stringify(aiSettingsValuesSchema.parse(settings), null, '\t'));
		await rename(staged, file);
	},
});
