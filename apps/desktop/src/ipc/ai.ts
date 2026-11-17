import { ok } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import type { AiService } from '../ai/ai-service';
import { type HandlerContext, handleRequest } from './handle';

/** `ai:*`. Keys and settings live in files and key checks call providers, so these run outside the database transactions. */
export const registerAiHandlers = (context: HandlerContext, ai: AiService): void => {
	handleRequest(context, CHANNELS.ai.getSettings, async () => ok(await ai.getSettings()));
	handleRequest(context, CHANNELS.ai.saveSettings, patch => ai.saveSettings(patch));
	handleRequest(context, CHANNELS.ai.saveKey, input => ai.saveKey(input));
	handleRequest(context, CHANNELS.ai.removeKey, provider => ai.removeKey(provider));
	handleRequest(context, CHANNELS.ai.testKey, provider => ai.testKey(provider));
	handleRequest(context, CHANNELS.ai.listVoices, () => ai.listVoices());
};
