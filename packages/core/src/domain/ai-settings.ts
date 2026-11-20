import { z } from 'zod';
import { LANGUAGES } from './settings';

/** Providers that generate text. Each one is enabled only once the user saves a key for it. */
export const TEXT_PROVIDERS = ['openai', 'anthropic', 'google', 'xai', 'groq'] as const;
/** Every provider that takes a key: the text ones plus ElevenLabs for speech to text and text to speech. */
export const AI_PROVIDERS = [...TEXT_PROVIDERS, 'elevenlabs'] as const;

export type TextProvider = (typeof TEXT_PROVIDERS)[number];
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** The models offered per text provider, the first being the default. Free-text model ids are deliberately not allowed. */
export const TEXT_MODELS = {
	anthropic: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
	google: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-pro'],
	groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'moonshotai/kimi-k2-instruct-0905', 'qwen/qwen3.6-27b'],
	openai: ['gpt-5.6', 'gpt-6.1-sol', 'gpt-6-sol', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4-nano'],
	xai: ['grok-4.7', 'grok-4.6', 'grok-4-1-fast-reasoning', 'grok-4-1-fast-non-reasoning'],
} as const satisfies Record<TextProvider, readonly [string, ...string[]]>;

/** ElevenLabs speech to text models, the first being the default. */
export const ELEVENLABS_STT_MODELS = ['scribe_v2', 'scribe_v2_turbo'] as const;
/** ElevenLabs text to speech models, the first being the default. `eleven_multilingual_v2` speaks both app languages. */
export const ELEVENLABS_TTS_MODELS = ['eleven_multilingual_v2', 'eleven_v3', 'eleven_v4', 'eleven_v4_turbo', 'eleven_flash_v2_5'] as const;

const textModelsSchema = z.object({
	anthropic: z.enum(TEXT_MODELS.anthropic),
	google: z.enum(TEXT_MODELS.google),
	groq: z.enum(TEXT_MODELS.groq),
	openai: z.enum(TEXT_MODELS.openai),
	xai: z.enum(TEXT_MODELS.xai),
});

/** An ElevenLabs voice id, as its API returns it. */
export const voiceIdSchema = z.string().trim().min(1, 'validation.required').max(64, 'validation.max');

/** One voice per app language, chosen independently; null until the user picks one. */
const voicesSchema = z.object({ en: voiceIdSchema.nullable(), es: voiceIdSchema.nullable() }) satisfies z.ZodType<Record<(typeof LANGUAGES)[number], string | null>>;

const elevenlabsSettingsSchema = z.object({
	sttModel: z.enum(ELEVENLABS_STT_MODELS),
	ttsModel: z.enum(ELEVENLABS_TTS_MODELS),
	voices: voicesSchema,
});

/** How quick add reads typed text: on this device (the default), or with one of the user's text providers. */
export const QUICK_ADD_MODES = ['local', 'ai'] as const;

export type QuickAddMode = (typeof QUICK_ADD_MODES)[number];

const quickAddSettingsSchema = z.object({ mode: z.enum(QUICK_ADD_MODES), provider: z.enum(TEXT_PROVIDERS).nullable() });

const DEFAULT_QUICK_ADD = { mode: 'local', provider: null } as const satisfies z.output<typeof quickAddSettingsSchema>;

/** The AI choices the user makes in Settings. Plain data: no keys, no SDK types. */
export const aiSettingsValuesSchema = z.object({
	elevenlabs: elevenlabsSettingsSchema,
	models: textModelsSchema,
	// Defaulted so settings saved before quick add existed stay valid and keep the local parser.
	quickAdd: quickAddSettingsSchema.default(DEFAULT_QUICK_ADD),
});

export type AiSettingsValues = z.output<typeof aiSettingsValuesSchema>;

/** A change to some of the AI settings; anything left out stays as it is. */
export const aiSettingsPatchSchema = z.strictObject({
	elevenlabs: z
		.strictObject({
			sttModel: elevenlabsSettingsSchema.shape.sttModel.optional(),
			ttsModel: elevenlabsSettingsSchema.shape.ttsModel.optional(),
			voices: voicesSchema.partial().strict().optional(),
		})
		.optional(),
	models: textModelsSchema.partial().strict().optional(),
	quickAdd: quickAddSettingsSchema.partial().strict().optional(),
});

export type AiSettingsPatch = z.input<typeof aiSettingsPatchSchema>;

/** Whether a key is saved, per provider. The keys themselves never leave the main process. */
export const aiKeyFlagsSchema = z.record(z.enum(AI_PROVIDERS), z.boolean());

export type AiKeyFlags = z.output<typeof aiKeyFlagsSchema>;

/** The AI settings as the UI sees them: the choices plus which providers have a key (and so are enabled). */
export const aiSettingsSchema = aiSettingsValuesSchema.extend({ keys: aiKeyFlagsSchema });

export type AiSettings = z.output<typeof aiSettingsSchema>;

export const aiProviderSchema = z.enum(AI_PROVIDERS);

/** A key to test and save for a provider. */
export const aiKeyInputSchema = z.object({
	key: z.string().trim().min(1, 'validation.required').max(512, 'validation.max'),
	provider: aiProviderSchema,
});

export type AiKeyInput = z.input<typeof aiKeyInputSchema>;

/** An ElevenLabs voice to pick from. */
export const aiVoiceSchema = z.object({ id: voiceIdSchema, name: z.string() });

export type AiVoice = z.output<typeof aiVoiceSchema>;

export const DEFAULT_AI_SETTINGS = {
	elevenlabs: { sttModel: ELEVENLABS_STT_MODELS[0], ttsModel: ELEVENLABS_TTS_MODELS[0], voices: { en: null, es: null } },
	models: {
		anthropic: TEXT_MODELS.anthropic[0],
		google: TEXT_MODELS.google[0],
		groq: TEXT_MODELS.groq[0],
		openai: TEXT_MODELS.openai[0],
		xai: TEXT_MODELS.xai[0],
	},
	quickAdd: DEFAULT_QUICK_ADD,
} as const satisfies AiSettingsValues;

/** The settings with `patch` applied; nested groups merge field by field. */
export const applyAiSettingsPatch = (current: AiSettingsValues, patch: z.output<typeof aiSettingsPatchSchema>): AiSettingsValues => ({
	elevenlabs: {
		sttModel: patch.elevenlabs?.sttModel ?? current.elevenlabs.sttModel,
		ttsModel: patch.elevenlabs?.ttsModel ?? current.elevenlabs.ttsModel,
		voices: { ...current.elevenlabs.voices, ...patch.elevenlabs?.voices },
	},
	models: { ...current.models, ...patch.models },
	quickAdd: { ...current.quickAdd, ...patch.quickAdd },
});
