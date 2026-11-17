import { describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS, resolveLanguage, settingsPatchSchema, settingsValuesSchema } from './settings';

describe('resolveLanguage', () => {
	test.each([
		[['es-PE', 'en-US'], 'es'],
		[['ES_es'], 'es'],
		[['fr-FR', 'en-GB', 'es'], 'en'],
		[['pt-BR', 'fr'], 'en'],
		[[], 'en'],
	] as const)('picks the first supported language of %p', (locales, expected) => {
		expect(resolveLanguage(locales)).toBe(expected);
	});
});

describe('notification and microphone preferences', () => {
	test('are on by default', () => {
		expect(DEFAULT_SETTINGS.notificationsEnabled).toBe(true);
		expect(DEFAULT_SETTINGS.microphoneEnabled).toBe(true);
		expect(settingsValuesSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
	});

	test('can be patched on their own', () => {
		expect(settingsPatchSchema.parse({ microphoneEnabled: false })).toEqual({ microphoneEnabled: false });
		expect(settingsPatchSchema.parse({ notificationsEnabled: false })).toEqual({ notificationsEnabled: false });
	});

	test('accept only booleans', () => {
		expect(settingsPatchSchema.safeParse({ notificationsEnabled: 'no' }).success).toBe(false);
		expect(settingsPatchSchema.safeParse({ microphoneEnabled: 0 }).success).toBe(false);
		const { microphoneEnabled: _, ...withoutMicrophone } = DEFAULT_SETTINGS;
		expect(settingsValuesSchema.safeParse(withoutMicrophone).success).toBe(false);
	});
});
