import type { SpeechRequest, TranscriptionRequest } from '@tempi/ai';
import {
	type AiKeyInput,
	type AiProvider,
	type AiSettings,
	type AiVoice,
	aiSettingsPatchSchema,
	applyAiSettingsPatch,
	fail,
	ok,
	type Result,
	SPEECH_AUDIO_TYPE,
	type Speech,
	type speechInputSchema,
	type Transcription,
	type transcriptionInputSchema,
} from '@tempi/core';
import type { z } from 'zod';
import type { AiKeyStore } from './key-store';
import type { AiSettingsStore } from './settings-store';

/** The `@tempi/ai` calls the service makes, injected so tests never reach a provider. */
export type AiProviders = {
	testKey: (provider: AiProvider, key: string) => Promise<Result<null>>;
	listVoices: (key: string) => Promise<Result<AiVoice[]>>;
	transcribe: (key: string, request: TranscriptionRequest) => Promise<Result<string>>;
	speak: (key: string, request: SpeechRequest) => Promise<Result<Uint8Array<ArrayBuffer>>>;
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
	/** Transcribes a dictation with the saved ElevenLabs key and the speech-to-text model from Settings. Nothing is stored. */
	transcribe: (input: z.output<typeof transcriptionInputSchema>) => Promise<Result<Transcription>>;
	/**
	 * Reads text aloud with the saved ElevenLabs key, the text-to-speech model from Settings and the voice chosen for the
	 * language. Without one it uses the other language's voice, then the account's first. Nothing is stored.
	 */
	speak: (input: z.output<typeof speechInputSchema>) => Promise<Result<Speech>>;
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
		speak: async ({ language, text }) => {
			const key = await keys.get('elevenlabs');
			if (key === null) return noKey('elevenlabs');
			const { elevenlabs } = await settings.read();
			const chosen = elevenlabs.voices[language] ?? elevenlabs.voices[language === 'en' ? 'es' : 'en'];
			let voiceId = chosen;
			if (voiceId === null) {
				const voices = await providers.listVoices(key);
				if (!voices.ok) return voices;
				voiceId = voices.value[0]?.id ?? null;
			}
			if (voiceId === null) return fail('not_found', 'ai.speechFailed', { detail: 'The ElevenLabs account has no voice to read with' });
			const audio = await providers.speak(key, { model: elevenlabs.ttsModel, text, voiceId });
			return audio.ok ? ok({ audio: audio.value, mimeType: SPEECH_AUDIO_TYPE }) : audio;
		},
		transcribe: async ({ audio, language, mimeType }) => {
			const key = await keys.get('elevenlabs');
			if (key === null) return noKey('elevenlabs');
			const { elevenlabs } = await settings.read();
			const text = await providers.transcribe(key, { audio, language, mimeType, model: elevenlabs.sttModel });
			return text.ok ? ok({ text: text.value }) : text;
		},
		testKey: async provider => {
			const key = await keys.get(provider);
			return key === null ? noKey(provider) : providers.testKey(provider, key);
		},
	};
};
