import { ASSISTANT_TOOLS, type AssistantMessage, type AssistantProposal, type AssistantStreamEvent, type AssistantTool, type DomainError, type TextProvider } from '@tempi/core';
import { APICallError, type LanguageModel, RetryError, stepCountIs, streamText } from 'ai';
import { type AssistantContext, assistantInstructions } from './assistant-context';
import { type AssistantPorts, assistantTools } from './assistant-tools';
import { networkFailure, statusFailure } from './failures';

export type AssistantRequest = {
	provider: TextProvider;
	model: LanguageModel;
	messages: readonly AssistantMessage[];
	context: AssistantContext;
	ports: AssistantPorts;
	/** Aborts the reply, e.g. when the user presses Stop. */
	signal?: AbortSignal;
	/** Receives every event of the reply, in order; the last one is `done` or `error`. */
	emit: (event: AssistantStreamEvent) => void;
};

/** Enough steps to look events up, propose a change and answer, without letting a confused model loop. */
const MAX_STEPS = 8;

const isAssistantTool = (name: string): name is AssistantTool => (ASSISTANT_TOOLS as readonly string[]).includes(name);

/** The `ai.*` failure a provider error means. Its message may echo the request, never the key. */
const providerFailure = (provider: TextProvider, error: unknown): DomainError => {
	const cause = RetryError.isInstance(error) ? error.lastError : error;
	const result =
		APICallError.isInstance(cause) && cause.statusCode !== undefined ? statusFailure(provider, cause.statusCode) : APICallError.isInstance(cause) ? networkFailure(provider, cause) : null;
	if (result !== null && !result.ok) return result.error;
	return { code: 'internal', issues: [{ detail: `${provider} failed: ${cause instanceof Error ? cause.message : String(cause)}`, key: 'ai.providerError' }] };
};

/**
 * One assistant reply: streams the model's text, runs read tools against the calendar and emits proposals for any
 * change, which the user confirms in the app. Never writes and never throws; failures arrive as an `error` event.
 */
export const runAssistant = async ({ context, emit, messages, model, ports, provider, signal }: AssistantRequest): Promise<void> => {
	// A tool runs before the stream reports its call, so its proposal waits for the result to keep events in order.
	const proposals = new Map<string, AssistantProposal>();
	const started = new Set<string>();
	const start = (id: string, name: string) => {
		if (started.has(id) || !isAssistantTool(name)) return;
		started.add(id);
		emit({ id, tool: name, type: 'tool-start' });
	};
	const end = (id: string, name: string, ok: boolean) => {
		if (!isAssistantTool(name)) return;
		start(id, name);
		emit({ id, ok, tool: name, type: 'tool-end' });
		const proposal = proposals.get(id);
		if (ok && proposal !== undefined) emit({ id: `proposal-${id}`, proposal, type: 'proposal' });
		proposals.delete(id);
	};

	try {
		const result = streamText({
			...(signal === undefined ? {} : { abortSignal: signal }),
			instructions: assistantInstructions(context),
			maxRetries: 1,
			messages: messages.map(({ role, text }) => ({ content: text, role })),
			model,
			// Failures are reported once, from the stream's error part; the default would also log them.
			onError: () => undefined,
			stopWhen: stepCountIs(MAX_STEPS),
			tools: assistantTools(context, ports, (toolCallId, proposal) => proposals.set(toolCallId, proposal)),
		});
		for await (const part of result.fullStream) {
			switch (part.type) {
				case 'text-delta':
					if (part.text !== '') emit({ text: part.text, type: 'text' });
					break;
				case 'tool-input-start':
					start(part.id, part.toolName);
					break;
				case 'tool-call':
					start(part.toolCallId, part.toolName);
					break;
				case 'tool-result':
					end(part.toolCallId, part.toolName, true);
					break;
				case 'tool-error':
					end(part.toolCallId, part.toolName, false);
					break;
				case 'error':
					emit({ error: providerFailure(provider, part.error), type: 'error' });
					return;
				case 'abort':
					return;
			}
		}
		emit({ type: 'done' });
	} catch (error) {
		if (signal?.aborted === true) return;
		emit({ error: providerFailure(provider, error), type: 'error' });
	}
};
