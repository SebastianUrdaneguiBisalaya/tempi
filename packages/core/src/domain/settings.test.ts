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

describe('tour completion', () => {
	test('starts pending so the tour shows once', () => {
		expect(DEFAULT_SETTINGS.tourCompleted).toBe(false);
	});

	test('can be patched on its own and accepts only booleans', () => {
		expect(settingsPatchSchema.parse({ tourCompleted: true })).toEqual({ tourCompleted: true });
		expect(settingsPatchSchema.safeParse({ tourCompleted: 1 }).success).toBe(false);
		const { tourCompleted: _, ...withoutTour } = DEFAULT_SETTINGS;
		expect(settingsValuesSchema.safeParse(withoutTour).success).toBe(false);
	});
});

describe('UI sounds', () => {
	test('are on by default with the tick preset', () => {
		expect(DEFAULT_SETTINGS.soundsEnabled).toBe(true);
		expect(DEFAULT_SETTINGS.sound).toBe('tick');
	});

	test('accept only the built-in presets', () => {
		expect(settingsPatchSchema.parse({ sound: 'pop', soundsEnabled: false })).toEqual({ sound: 'pop', soundsEnabled: false });
		expect(settingsPatchSchema.safeParse({ sound: 'chime' }).success).toBe(false);
		expect(settingsPatchSchema.safeParse({ soundsEnabled: 'on' }).success).toBe(false);
	});
});

describe('icon badge', () => {
	test('is on by default and accepts only booleans', () => {
		expect(DEFAULT_SETTINGS.iconBadgeEnabled).toBe(true);
		expect(settingsPatchSchema.parse({ iconBadgeEnabled: false })).toEqual({ iconBadgeEnabled: false });
		expect(settingsPatchSchema.safeParse({ iconBadgeEnabled: 'no' }).success).toBe(false);
	});
});

describe('opening at login', () => {
	test('is off by default and accepts only booleans', () => {
		expect(DEFAULT_SETTINGS.openAtLoginEnabled).toBe(false);
		expect(settingsPatchSchema.parse({ openAtLoginEnabled: true })).toEqual({ openAtLoginEnabled: true });
		expect(settingsPatchSchema.safeParse({ openAtLoginEnabled: 'yes' }).success).toBe(false);
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
