import { type DomainError, fail, parseWith, type QuickAddContext, type QuickAddProposal, quickAddProposalSchema, type Result, type TextProvider } from '@tempi/core';
import { APICallError, generateText, jsonSchema, type LanguageModel, Output, RetryError } from 'ai';
import { z } from 'zod';
import { localInstant } from './assistant-context';
import { networkFailure, providerFailure, REQUEST_TIMEOUT_MS } from './failures';

export type QuickAddRequest = {
	provider: TextProvider;
	model: LanguageModel;
	text: string;
	context: QuickAddContext;
	/** Defaults to `REQUEST_TIMEOUT_MS`. */
	timeoutMs?: number;
};

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish' } as const satisfies Record<QuickAddContext['language'], string>;

/**
 * The core schema as JSON Schema, with every field required (the optional ones are nullable): strict structured output
 * (OpenAI) demands it, and it makes the model answer each field.
 */
const proposalJsonSchema = (() => {
	const schema = z.toJSONSchema(quickAddProposalSchema, { io: 'input', unrepresentable: 'any' });
	return { ...schema, required: Object.keys(schema.properties ?? {}) };
})();

// The answer is parsed here with `parseWith`, so a wrong field becomes the same issues the forms know instead of an SDK error.
const proposalOutput = Output.object({
	description: 'One new calendar event read from the user’s text.',
	name: 'event',
	schema: jsonSchema<unknown>(proposalJsonSchema, { validate: value => ({ success: true, value }) }),
});

const instructions = ({ defaultEventDuration, language, now, timeZone }: QuickAddContext): string => {
	const zoned = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timeZone);
	return `You read one new calendar event from a short text the user typed, in any language, and fill the event fields.

Context:
- Now: ${zoned.toLocaleString('en-US', { weekday: 'long' })}, ${localInstant(now, timeZone)} (time zone ${timeZone}).
- The user's app language is ${LANGUAGE_NAMES[language]}.

Rules:
- title: what the event is, short, in the user's words and language, without the date, time, place or reminder.
- Resolve relative dates ("tomorrow", "next Friday", "mañana") from now, in the user's time zone. A date without a year is the next one to come.
- startAt and endAt: ISO-8601 with the user's UTC offset, e.g. 2026-11-18T15:00:00-05:00.
- Without an end or a duration, a timed event lasts ${defaultEventDuration} minutes.
- Without a time, the event is all-day: allDay true, startAt at 00:00 of its first day and endAt at 00:00 of the day after its last day.
- location: the place, if the text names one; otherwise null.
- description: only details the text gives that fit nowhere else; otherwise null.
- reminderMinutes: how many minutes before the start to remind ("remind me 30 min before" is 30, "an hour before" is 60); null if the text asks for none.
- Never invent anything the text doesn't say.`;
};

/** Whatever failed after the provider answered: the reply wasn't the event the schema asks for. */
const invalidReply = (provider: TextProvider, detail: string): Result<never> => fail('internal', 'ai.invalidReply', { detail: `${provider} replied with no valid event: ${detail}` });

const isProviderError = (error: unknown): boolean => APICallError.isInstance(RetryError.isInstance(error) ? error.lastError : error);

/**
 * Reads one new event from quick add text with the chosen model and structured output. Never writes and never throws:
 * the user reviews the proposal in the event form. Fails with `ai.invalidKey`, `ai.rateLimited`, `ai.network`
 * (offline or timed out), `ai.providerError` or `ai.invalidReply`.
 */
export const parseQuickAdd = async ({ context, model, provider, text, timeoutMs = REQUEST_TIMEOUT_MS }: QuickAddRequest): Promise<Result<QuickAddProposal>> => {
	const signal = AbortSignal.timeout(timeoutMs);
	let output: unknown;
	try {
		const result = await generateText({ abortSignal: signal, instructions: instructions(context), maxRetries: 1, model, output: proposalOutput, prompt: text });
		output = result.output;
	} catch (error) {
		if (signal.aborted) return networkFailure(provider, error);
		if (isProviderError(error)) return { error: providerFailure(provider, error) satisfies DomainError, ok: false };
		return invalidReply(provider, error instanceof Error ? error.message : String(error));
	}
	const parsed = parseWith(quickAddProposalSchema, output);
	return parsed.ok ? parsed : invalidReply(provider, parsed.error.issues.map(issue => `${issue.field ?? '(root)'}: ${issue.detail}`).join('; '));
};
