import { z } from 'zod';
import { TEXT_PROVIDERS } from './ai-settings';
import { calendarEventSchema, eventPatchSchema, newEventInputSchema } from './event';
import { domainErrorSchema } from './result';
import { idSchema } from './values';

/** The tools the assistant can call. Reads run against the calendar; changes only come back as proposals. */
export const ASSISTANT_TOOLS = ['listCalendars', 'listEvents', 'searchEvents', 'createEvent', 'updateEvent', 'deleteEvent'] as const;

export type AssistantTool = (typeof ASSISTANT_TOOLS)[number];

/** Upper bounds that keep one chat request small enough for IPC and a provider's context. */
export const MAX_ASSISTANT_MESSAGES = 100;
export const MAX_ASSISTANT_MESSAGE_LENGTH = 8000;

/** One turn of the conversation as the model sees it: what the user wrote, or what the assistant answered. */
export const assistantMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	text: z.string().trim().min(1, 'validation.required').max(MAX_ASSISTANT_MESSAGE_LENGTH, 'validation.max'),
});

export type AssistantMessage = z.output<typeof assistantMessageSchema>;

/** Starts one assistant reply. `requestId` names the stream its events arrive on. */
export const assistantChatInputSchema = z.object({
	messages: z.array(assistantMessageSchema).min(1, 'validation.min').max(MAX_ASSISTANT_MESSAGES, 'validation.max'),
	provider: z.enum(TEXT_PROVIDERS),
	requestId: z.uuid(),
});

export type AssistantChatInput = z.input<typeof assistantChatInputSchema>;

/**
 * A change the assistant suggests. Nothing is saved until the user confirms it, through the same use cases as the
 * event form, so every rule still applies.
 */
export const assistantProposalSchema = z.discriminatedUnion('kind', [
	z.object({ input: newEventInputSchema, kind: z.literal('create') }),
	z.object({ event: calendarEventSchema, id: idSchema, kind: z.literal('update'), patch: eventPatchSchema }),
	z.object({ event: calendarEventSchema, kind: z.literal('delete') }),
]);

export type AssistantProposal = z.output<typeof assistantProposalSchema>;

/** What one reply streams to the renderer, in order, ending with `done` or `error`. */
export const assistantStreamEventSchema = z.discriminatedUnion('type', [
	z.object({ text: z.string(), type: z.literal('text') }),
	z.object({ id: z.string(), tool: z.enum(ASSISTANT_TOOLS), type: z.literal('tool-start') }),
	z.object({ id: z.string(), ok: z.boolean(), tool: z.enum(ASSISTANT_TOOLS), type: z.literal('tool-end') }),
	z.object({ id: z.string(), proposal: assistantProposalSchema, type: z.literal('proposal') }),
	z.object({ error: domainErrorSchema, type: z.literal('error') }),
	z.object({ type: z.literal('done') }),
]);

export type AssistantStreamEvent = z.output<typeof assistantStreamEventSchema>;
