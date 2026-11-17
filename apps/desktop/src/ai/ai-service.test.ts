import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type AiProvider, DEFAULT_AI_SETTINGS, fail, ok } from '@tempi/core';
import type { Cipher } from '../google/token-store';
import { type AiProviders, createAiService } from './ai-service';
import { createAiKeyStore } from './key-store';
import { createAiSettingsStore } from './settings-store';

const cipher = (available = true): Cipher => ({
	decrypt: data => Buffer.from(data.toString('utf8'), 'base64').reverse().toString('utf8'),
	encrypt: text => Buffer.from(Buffer.from(text, 'utf8').reverse().toString('base64'), 'utf8'),
	isAvailable: () => available,
});

const none = { anthropic: false, elevenlabs: false, google: false, groq: false, openai: false, xai: false };

/** Providers that accept only `good-key`, recording every key test. */
const fakeProviders = () => {
	const tested: [AiProvider, string][] = [];
	const transcribed: unknown[] = [];
	const providers: AiProviders = {
		listVoices: key => Promise.resolve(key === 'good-key' ? ok([{ id: 'v1', name: 'Ada' }]) : fail('validation', 'ai.invalidKey')),
		testKey: (provider, key) => {
			tested.push([provider, key]);
			return Promise.resolve(key === 'good-key' ? ok(null) : fail('validation', 'ai.invalidKey', { field: 'key' }));
		},
		transcribe: (key, request) => {
			transcribed.push({ key, ...request });
			return Promise.resolve(ok('crea una reunión con Ana el viernes a las 10'));
		},
	};
	return { providers, tested, transcribed };
};

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(path.join(tmpdir(), 'tempi-ai-'));
});

afterEach(() => rm(dir, { force: true, recursive: true }));

const service = (options: { available?: boolean } = {}) => {
	const fake = fakeProviders();
	const ai = createAiService({
		keys: createAiKeyStore(path.join(dir, 'ai-keys.bin'), cipher(options.available)),
		providers: fake.providers,
		settings: createAiSettingsStore(path.join(dir, 'ai-settings.json')),
	});
	return { ai, tested: fake.tested, transcribed: fake.transcribed };
};

const keyOf = (result: { ok: boolean; error?: { issues: { key: string }[] } }) => (result.ok ? null : result.error?.issues[0]?.key);

describe('AI service', () => {
	test('by default no provider has a key and nothing calls a provider', async () => {
		const { ai, tested } = service();
		expect(await ai.getSettings()).toEqual({ ...DEFAULT_AI_SETTINGS, keys: none });
		expect(keyOf(await ai.listVoices())).toBe('ai.invalidKey');
		expect(keyOf(await ai.testKey('openai'))).toBe('ai.invalidKey');
		expect(tested).toEqual([]);
	});

	test('saves a key only after the provider accepts it, and answers without the key', async () => {
		const { ai, tested } = service();
		const rejected = await ai.saveKey({ key: 'bad-key', provider: 'openai' });
		expect(keyOf(rejected)).toBe('ai.invalidKey');
		expect((await ai.getSettings()).keys.openai).toBe(false);

		const saved = await ai.saveKey({ key: 'good-key', provider: 'openai' });
		expect(saved).toEqual({ ok: true, value: { ...DEFAULT_AI_SETTINGS, keys: { ...none, openai: true } } });
		expect(JSON.stringify(saved)).not.toContain('good-key');
		expect(tested).toEqual([
			['openai', 'bad-key'],
			['openai', 'good-key'],
		]);
		expect(await ai.testKey('openai')).toEqual({ ok: true, value: null });
	});

	test('fails with ai.encryptionUnavailable instead of storing plain text, without sending the key anywhere', async () => {
		const { ai, tested } = service({ available: false });
		expect(keyOf(await ai.saveKey({ key: 'good-key', provider: 'anthropic' }))).toBe('ai.encryptionUnavailable');
		expect(tested).toEqual([]);
		expect((await ai.getSettings()).keys.anthropic).toBe(false);
	});

	test('removing a key disables the provider', async () => {
		const { ai } = service();
		await ai.saveKey({ key: 'good-key', provider: 'groq' });
		const removed = await ai.removeKey('groq');
		expect(removed.ok && removed.value.keys.groq).toBe(false);
	});

	test('lists voices with the saved ElevenLabs key', async () => {
		const { ai } = service();
		await ai.saveKey({ key: 'good-key', provider: 'elevenlabs' });
		expect(await ai.listVoices()).toEqual({ ok: true, value: [{ id: 'v1', name: 'Ada' }] });
	});

	test('settings persist across restarts, and English and Spanish voices change independently', async () => {
		await service().ai.saveSettings({ elevenlabs: { voices: { en: 'voice-en' } }, models: { anthropic: 'claude-haiku-5-5' } });
		await service().ai.saveSettings({ elevenlabs: { voices: { es: 'voice-es' } } });
		const settings = await service().ai.getSettings();
		expect(settings.models.anthropic).toBe('claude-haiku-5-5');
		expect(settings.elevenlabs.voices).toEqual({ en: 'voice-en', es: 'voice-es' });
	});
});

describe('dictation', () => {
	const audio = new Uint8Array([26, 69, 223, 163]);

	test('needs an ElevenLabs key, and sends nothing without one', async () => {
		const { ai, transcribed } = service();
		expect(keyOf(await ai.transcribe({ audio, language: 'es', mimeType: 'audio/webm' }))).toBe('ai.invalidKey');
		expect(transcribed).toEqual([]);
	});

	test('transcribes with the saved key, the speech-to-text model from Settings and the app language', async () => {
		const { ai, transcribed } = service();
		await ai.saveKey({ key: 'good-key', provider: 'elevenlabs' });
		await ai.saveSettings({ elevenlabs: { sttModel: 'scribe_v2_turbo' } });
		expect(await ai.transcribe({ audio, language: 'es', mimeType: 'audio/webm' })).toEqual({ ok: true, value: { text: 'crea una reunión con Ana el viernes a las 10' } });
		expect(transcribed).toEqual([{ audio, key: 'good-key', language: 'es', mimeType: 'audio/webm', model: 'scribe_v2_turbo' }]);
	});
});
