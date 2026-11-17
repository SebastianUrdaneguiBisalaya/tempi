import { type AiKeyInput, type AiProvider, type AiSettings, type AiVoice, aiSettingsPatchSchema, applyAiSettingsPatch, fail, ok, type Result } from '@tempi/core';
import type { z } from 'zod';
import type { AiKeyStore } from './key-store';
import type { AiSettingsStore } from './settings-store';

/** The `@tempi/ai` calls the service makes, injected so tests never reach a provider. */
export type AiProviders = {
	testKey: (provider: AiProvider, key: string) => Promise<Result<null>>;
	listVoices: (key: string) => Promise<Result<AiVoice[]>>;
};

export type AiServiceDeps = { keys: AiKeyStore; settings: AiSettingsStore; providers: AiProviders };

/** Settings → Integrations for AI. Keys stay inside: every answer says only whether a provider has one. */
export type AiService = {
	getSettings: () => Promise<AiSettings>;
	saveSettings: (patch: z.output<typeof aiSettingsPatchSchema>) => Promise<Result<AiSettings>>;
	/** Tests the key first and saves it only if the provider accepts it. */
	saveKey: (input: Required<AiKeyInput>) => Promise<Result<AiSettings>>;
	removeKey: (provider: AiProvider) => Promise<Result<AiSettings>>;
	/** Tests the saved key again. */
	testKey: (provider: AiProvider) => Promise<Result<null>>;
	/** The voices of the saved ElevenLabs key's account. */
	listVoices: () => Promise<Result<AiVoice[]>>;
};

const noKey = (provider: AiProvider) => fail<never>('not_found', 'ai.invalidKey', { detail: `No key is saved for ${provider}` });

export const createAiService = ({ keys, providers, settings }: AiServiceDeps): AiService => {
	const view = async (): Promise<AiSettings> => ({ ...(await settings.read()), keys: await keys.flags() });

	return {
		getSettings: view,
		listVoices: async () => {
			const key = await keys.get('elevenlabs');
			return key === null ? noKey('elevenlabs') : providers.listVoices(key);
		},
		removeKey: async provider => {
			await keys.remove(provider);
			return ok(await view());
		},
		saveKey: async ({ key, provider }) => {
			// Checked before calling the provider, so an unprotected system never sends a key it can't keep.
			if (!keys.isAvailable()) return fail('internal', 'ai.encryptionUnavailable');
			const tested = await providers.testKey(provider, key);
			if (!tested.ok) return tested;
			await keys.save(provider, key);
			return ok(await view());
		},
		saveSettings: async patch => {
			await settings.write(applyAiSettingsPatch(await settings.read(), patch));
			return ok(await view());
		},
		testKey: async provider => {
			const key = await keys.get(provider);
			return key === null ? noKey(provider) : providers.testKey(provider, key);
		},
	};
};
