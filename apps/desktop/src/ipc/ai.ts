import { ok } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import type { AiService } from '../ai/ai-service';
import type { AssistantChat, AssistantSink } from '../ai/assistant-chat';
import { type HandlerContext, handleRequest, type IpcSender } from './handle';

/** The AI work behind `ai:*`: settings and keys, and assistant replies streamed to the frame that asked. */
export type AiIo = {
	service: AiService;
	chat: AssistantChat;
	/** Opens the stream a reply's events go to, sending the frame its other end. */
	openStream: (sender: IpcSender, requestId: string) => AssistantSink;
};

/** `ai:*`. Keys and settings live in files and key checks call providers, so these run outside the database transactions. */
export const registerAiHandlers = (context: HandlerContext, { chat, openStream, service: ai }: AiIo): void => {
	handleRequest(context, CHANNELS.ai.getSettings, async () => ok(await ai.getSettings()));
	handleRequest(context, CHANNELS.ai.saveSettings, patch => ai.saveSettings(patch));
	handleRequest(context, CHANNELS.ai.saveKey, input => ai.saveKey(input));
	handleRequest(context, CHANNELS.ai.removeKey, provider => ai.removeKey(provider));
	handleRequest(context, CHANNELS.ai.testKey, provider => ai.testKey(provider));
	handleRequest(context, CHANNELS.ai.listVoices, () => ai.listVoices());
	handleRequest(context, CHANNELS.ai.transcribe, input => ai.transcribe(input));
	// The answer only says the reply started; its events stream on a MessagePort (see AGENTS.md › IPC).
	handleRequest(context, CHANNELS.ai.chat, (input, sender) => chat(input, () => openStream(sender, input.requestId)));
};
