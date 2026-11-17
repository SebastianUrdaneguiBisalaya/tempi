import type { AssistantContext, AssistantPorts, runAssistant, textModel } from '@tempi/ai';
import {
	type AssistantStreamEvent,
	type assistantChatInputSchema,
	type CoreDeps,
	type DomainError,
	fail,
	getProfile,
	getSettings,
	listCalendars,
	listEvents,
	ok,
	type Result,
	searchEvents,
} from '@tempi/core';
import type { TransactionQueue } from '@tempi/db';
import type { z } from 'zod';
import type { AiKeyStore } from './key-store';
import type { AiSettingsStore } from './settings-store';

/** Where one reply's events go: the main process end of its `MessagePort`. Closed by the renderer to stop the reply. */
export type AssistantSink = {
	send: (event: AssistantStreamEvent) => void;
	close: () => void;
	/** Aborts once the renderer closes its end. */
	signal: AbortSignal;
};

export type AssistantChatDeps = {
	keys: AiKeyStore;
	settings: AiSettingsStore;
	context: () => Promise<AssistantContext>;
	ports: AssistantPorts;
	model: typeof textModel;
	run: typeof runAssistant;
};

/** Starts a reply and answers at once; the reply streams to the sink `openSink` opens. */
export type AssistantChat = (input: z.output<typeof assistantChatInputSchema>, openSink: () => AssistantSink) => Promise<Result<null>>;

export const createAssistantChat =
	(deps: AssistantChatDeps): AssistantChat =>
	async ({ messages, provider, voice = false }, openSink) => {
		// Checked before anything streams, so a provider without a key fails the request itself.
		const key = await deps.keys.get(provider);
		if (key === null) return fail('not_found', 'ai.invalidKey', { detail: `No key is saved for ${provider}` });
		const [settings, context] = await Promise.all([deps.settings.read(), deps.context()]);
		const sink = openSink();
		void deps.run({ context, emit: sink.send, messages, model: deps.model(provider, key, settings.models), ports: deps.ports, provider, signal: sink.signal, voice }).finally(sink.close);
		return ok(null);
	};

const orThrow = <T>(result: Result<T>): T => {
	if (result.ok) return result.value;
	throw new Error(result.error.issues.map((issue: DomainError['issues'][number]) => issue.detail).join('; '));
};

/** The assistant's reads, each one a transaction like any renderer read. A failure becomes a failed tool call. */
export const assistantPorts = (deps: CoreDeps, transaction: TransactionQueue): AssistantPorts => ({
	findEvent: async id => {
		const event = orThrow(await transaction(async () => ok(await deps.events.findById(id))));
		return event === null || event.deletedAt !== null ? null : event;
	},
	listEvents: async range => orThrow(await transaction(() => listEvents(deps, range))),
	searchEvents: async query => orThrow(await transaction(() => searchEvents(deps, query))),
});

/** The context of one request, read fresh so a new calendar or time zone counts right away. */
export const assistantContext =
	(deps: CoreDeps, transaction: TransactionQueue, now: () => Date): (() => Promise<AssistantContext>) =>
	async () => {
		const read = await transaction(async () => ok({ calendars: await listCalendars(deps), profile: await getProfile(deps), settings: await getSettings(deps) }));
		const { calendars, profile, settings } = orThrow(read);
		return {
			calendars,
			defaultEventDuration: settings.defaultEventDuration,
			language: settings.language,
			now: now(),
			timeZone: profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
			weekStart: settings.weekStart,
		};
	};
