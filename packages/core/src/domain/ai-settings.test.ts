import { describe, expect, test } from 'bun:test';
import { aiKeyInputSchema, aiSettingsPatchSchema, aiSettingsSchema, aiSettingsValuesSchema, applyAiSettingsPatch, DEFAULT_AI_SETTINGS, TEXT_MODELS, TEXT_PROVIDERS } from './ai-settings';
import { parseWith } from './result';

const keys = { anthropic: false, elevenlabs: true, google: false, groq: false, openai: true, xai: false };

describe('AI settings', () => {
	test('the defaults are valid and pick the first model of each list', () => {
		expect(aiSettingsValuesSchema.parse(DEFAULT_AI_SETTINGS)).toEqual(DEFAULT_AI_SETTINGS);
		for (const provider of TEXT_PROVIDERS) expect(DEFAULT_AI_SETTINGS.models[provider]).toBe(TEXT_MODELS[provider][0]);
	});

	test('a model must come from its provider’s fixed list', () => {
		const result = parseWith(aiSettingsPatchSchema, { models: { anthropic: 'gpt-5.6', openai: 'my-custom-model' } });
		expect(result.ok ? [] : result.error.issues.map(issue => [issue.field, issue.key])).toEqual([
			['models.anthropic', 'validation.invalid_value'],
			['models.openai', 'validation.invalid_value'],
		]);
	});

	test('the UI view carries a key flag for every provider', () => {
		expect(aiSettingsSchema.safeParse({ ...DEFAULT_AI_SETTINGS, keys }).success).toBe(true);
		const { xai: _, ...missing } = keys;
		expect(aiSettingsSchema.safeParse({ ...DEFAULT_AI_SETTINGS, keys: missing }).success).toBe(false);
	});

	test('a patch rejects unknown fields, so a key can never ride along with the settings', () => {
		expect(aiSettingsPatchSchema.safeParse({ apiKey: 'sk-secret' }).success).toBe(false);
		expect(aiSettingsPatchSchema.safeParse({ models: { openai: 'gpt-5.6', key: 'sk-secret' } }).success).toBe(false);
	});

	test('a patch changes only what it names; English and Spanish voices change independently', () => {
		const withEnglish = applyAiSettingsPatch(DEFAULT_AI_SETTINGS, aiSettingsPatchSchema.parse({ elevenlabs: { voices: { en: 'voice-en' } } }));
		const withBoth = applyAiSettingsPatch(withEnglish, aiSettingsPatchSchema.parse({ elevenlabs: { voices: { es: 'voice-es' } }, models: { groq: 'openai/gpt-oss-20b' } }));
		expect(withBoth).toEqual({
			elevenlabs: { ...DEFAULT_AI_SETTINGS.elevenlabs, voices: { en: 'voice-en', es: 'voice-es' } },
			models: { ...DEFAULT_AI_SETTINGS.models, groq: 'openai/gpt-oss-20b' },
		});
		expect(applyAiSettingsPatch(withBoth, aiSettingsPatchSchema.parse({ elevenlabs: { voices: { en: null } } })).elevenlabs.voices).toEqual({ en: null, es: 'voice-es' });
	});

	test('a key input is trimmed, required and bounded', () => {
		expect(aiKeyInputSchema.parse({ key: '  sk-abc  ', provider: 'openai' })).toEqual({ key: 'sk-abc', provider: 'openai' });
		const result = parseWith(aiKeyInputSchema, { key: '   ', provider: 'mistral' });
		expect(result.ok ? [] : result.error.issues.map(issue => [issue.field, issue.key])).toEqual([
			['key', 'validation.required'],
			['provider', 'validation.invalid_value'],
		]);
	});
});
