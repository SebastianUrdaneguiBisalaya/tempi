import {
	type AssistantProposal,
	type CalendarEvent,
	type DateRange,
	type DomainIssue,
	dateRangeSchema,
	type EventOccurrence,
	eventFieldsSchema,
	eventPatchSchema,
	eventSearchQuerySchema,
	type FreeSlots,
	type FreeSlotsQuery,
	freeSlotsQuerySchema,
	idSchema,
	newEventInputSchema,
	parseWith,
	type Result,
} from '@tempi/core';
import { jsonSchema, tool } from 'ai';
import { z } from 'zod';
import { type AssistantContext, localInstant } from './assistant-context';

/** Reads the assistant may make. There is deliberately no way to write: changes only leave as proposals. */
export type AssistantPorts = {
	listEvents: (range: DateRange) => Promise<EventOccurrence[]>;
	searchEvents: (query: string) => Promise<EventOccurrence[]>;
	findEvent: (id: string) => Promise<CalendarEvent | null>;
	findFreeSlots: (query: FreeSlotsQuery) => Promise<FreeSlots>;
};

/** What a tool answers the model: data, a proposal shown to the user, or the issues to fix first. */
type ToolAnswer =
	| { events: ReturnType<typeof eventSummary>[] }
	| { calendars: unknown[] }
	| { days: { date: string; free: { end: string; start: string }[] }[] }
	| { status: 'proposed'; note: string }
	| { issues: Pick<DomainIssue, 'detail' | 'field' | 'key'>[]; status: 'invalid' };

/**
 * The model gets each core schema as JSON Schema, but its input is checked here with `parseWith`, so invalid input
 * reaches the model as the same issues the forms show instead of failing the tool call.
 */
const lenient = <S extends z.ZodType>(schema: S) => jsonSchema<unknown>(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }), { validate: value => ({ success: true, value }) });

const invalid = (issues: readonly DomainIssue[]): ToolAnswer => ({ issues: issues.map(({ detail, field, key }) => ({ detail, field, key })), status: 'invalid' });

const unwrapIssues = <T>(result: Result<T>): DomainIssue[] => (result.ok ? [] : result.error.issues);

const notFound = (id: string): ToolAnswer => invalid([{ detail: `No event has id ${id}`, field: 'id', key: 'event.notFound' }]);

/** An event as the model reads it: times in the user's zone, only the fields it needs. */
const eventSummary = (event: EventOccurrence | CalendarEvent, timeZone: string) => ({
	allDay: event.allDay,
	calendarId: event.calendarId,
	end: localInstant(event.endAt, timeZone),
	id: event.id,
	location: event.location,
	recurring: event.rrule !== null,
	start: localInstant(event.startAt, timeZone),
	title: event.title,
});

const PROPOSED: ToolAnswer = { note: 'Shown to the user to confirm. Nothing is saved until they confirm it.', status: 'proposed' };

/** The assistant's tools. `propose` receives each valid change with the call that made it; the tools never write. */
export const assistantTools = (context: AssistantContext, ports: AssistantPorts, propose: (toolCallId: string, proposal: AssistantProposal) => void) => {
	const writableIds = new Set(context.calendars.filter(calendar => !calendar.readOnly).map(calendar => calendar.id));
	const calendarIssue = (calendarId: string | undefined): DomainIssue[] =>
		calendarId === undefined || writableIds.has(calendarId) ? [] : [{ detail: `Calendar ${calendarId} doesn't exist or is read-only`, field: 'calendarId', key: 'calendar.readOnly' }];

	const updateInput = eventPatchSchema.extend({ id: idSchema });

	return {
		createEvent: tool({
			description: 'Propose a new event. The user must confirm it; nothing is saved by this call.',
			execute: (input, { toolCallId }) => {
				const parsed = parseWith(newEventInputSchema, input);
				const issues = [...unwrapIssues(parsed), ...(parsed.ok ? calendarIssue(parsed.value.calendarId) : [])];
				if (!parsed.ok || issues.length > 0) return Promise.resolve(invalid(issues));
				propose(toolCallId, { input: parsed.value, kind: 'create' });
				return Promise.resolve(PROPOSED);
			},
			inputSchema: lenient(newEventInputSchema),
		}),
		deleteEvent: tool({
			description: 'Propose deleting an event by id. The user must confirm it; nothing is deleted by this call.',
			execute: async (input, { toolCallId }) => {
				const parsed = parseWith(z.object({ id: idSchema }), input);
				if (!parsed.ok) return invalid(parsed.error.issues);
				const event = await ports.findEvent(parsed.value.id);
				if (event === null) return notFound(parsed.value.id);
				if (!writableIds.has(event.calendarId)) return invalid(calendarIssue(event.calendarId));
				propose(toolCallId, { event, kind: 'delete' });
				return PROPOSED;
			},
			inputSchema: lenient(z.object({ id: idSchema })),
		}),
		findFreeTime: tool({
			description:
				'Find free time on some days (from and to are YYYY-MM-DD, both included). Without a window or weekdays it searches the user’s working hours, or 09:00–18:00 Monday to Friday; minMinutes is the shortest slot worth listing (30 by default). Reads only.',
			execute: async (input): Promise<ToolAnswer> => {
				const query = parseWith(freeSlotsQuerySchema, input);
				if (!query.ok) return invalid(query.error.issues);
				const found = await ports.findFreeSlots(query.value);
				return {
					days: found.days.map(day => ({
						date: day.date,
						free: day.slots.map(slot => ({ end: localInstant(slot.endAt, found.timeZone), start: localInstant(slot.startAt, found.timeZone) })),
					})),
				};
			},
			inputSchema: lenient(freeSlotsQuerySchema),
		}),
		listCalendars: tool({
			description: 'List the user’s calendars.',
			execute: (): Promise<ToolAnswer> => Promise.resolve({ calendars: context.calendars.map(({ id, isDefault, name, readOnly }) => ({ id, isDefault, name, readOnly })) }),
			inputSchema: lenient(z.object({})),
		}),
		listEvents: tool({
			description: 'List the events between two date-times (start inclusive, end exclusive).',
			execute: async input => {
				const range = parseWith(dateRangeSchema, input);
				if (!range.ok) return invalid(range.error.issues);
				return { events: (await ports.listEvents(range.value)).map(event => eventSummary(event, context.timeZone)) };
			},
			inputSchema: lenient(dateRangeSchema),
		}),
		searchEvents: tool({
			description: 'Search events by text in their title, location or description.',
			execute: async input => {
				const query = parseWith(z.object({ query: eventSearchQuerySchema }), input);
				if (!query.ok) return invalid(query.error.issues);
				return { events: (await ports.searchEvents(query.value.query)).map(event => eventSummary(event, context.timeZone)) };
			},
			inputSchema: lenient(z.object({ query: eventSearchQuerySchema })),
		}),
		updateEvent: tool({
			description: 'Propose changing some fields of an event by id. The user must confirm it; nothing is saved by this call.',
			execute: async (input, { toolCallId }) => {
				const parsed = parseWith(updateInput, input);
				if (!parsed.ok) return invalid(parsed.error.issues);
				const { id, ...patch } = parsed.value;
				const event = await ports.findEvent(id);
				if (event === null) return notFound(id);
				// Cross-field rules (the end after the start) only hold on the merged event, as in the update use case.
				const merged = parseWith(eventFieldsSchema, { ...event, ...patch });
				const issues = [...calendarIssue(event.calendarId), ...calendarIssue(patch.calendarId), ...unwrapIssues(merged)];
				if (issues.length > 0) return invalid(issues);
				propose(toolCallId, { event, id, kind: 'update', patch });
				return PROPOSED;
			},
			inputSchema: lenient(updateInput),
		}),
	};
};
