import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import type { AiSettingsValues, TextProvider } from '@tempi/core';
import type { LanguageModel } from 'ai';
import type { AiRequestOptions } from './voices';

/** The text model the user chose for `provider`, called with their own key. Used by the AI processes (`generateText`, …). */
export const textModel = (provider: TextProvider, key: string, models: AiSettingsValues['models'], options: AiRequestOptions = {}): LanguageModel => {
	const settings = { apiKey: key, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) };
	switch (provider) {
		case 'anthropic':
			return createAnthropic(settings)(models.anthropic);
		case 'google':
			return createGoogle(settings)(models.google);
		case 'groq':
			return createGroq(settings)(models.groq);
		case 'openai':
			return createOpenAI(settings)(models.openai);
		case 'xai':
			return createXai(settings)(models.xai);
	}
};
