import type { Calendar, Language, WeekStart } from '@tempi/core';

/** What the model must know to resolve "tomorrow at 3pm" or "next Tuesday": built fresh for every request. */
export type AssistantContext = {
	now: Date;
	/** The user's IANA time zone, from their profile. */
	timeZone: string;
	language: Language;
	weekStart: WeekStart;
	/** Minutes a new event lasts when the user gives no end. */
	defaultEventDuration: number;
	calendars: readonly Calendar[];
};

/** An instant as wall time in `timeZone` with its offset, e.g. `2026-11-18T15:00:00-05:00`, which every event field accepts. */
export const localInstant = (instant: string | Date, timeZone: string): string => {
	const zoned = Temporal.Instant.from(typeof instant === 'string' ? instant : instant.toISOString()).toZonedDateTimeISO(timeZone);
	return zoned.toString({ fractionalSecondDigits: 0, timeZoneName: 'never' });
};

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish' } as const satisfies Record<Language, string>;

/** Added when the reply is read aloud: the user hears it instead of reading it, and confirms changes on screen. */
const VOICE_RULES = `

Voice:
- The user is talking to you and hears your reply read aloud. Answer in one to three short spoken sentences.
- Write plain sentences only: no Markdown, lists, headings, emoji, ids or URLs. Say times and dates the way people speak them.
- When you propose a change, say what you propose (title, day and time) and that it is on screen to confirm or cancel.`;

/**
 * The system instructions: who the assistant is, how it may change the calendar, and the user's context. `voice`
 * adapts the replies to being heard (Voice tab).
 */
export const assistantInstructions = (context: AssistantContext, { voice = false }: { voice?: boolean } = {}): string => {
	const now = Temporal.Instant.from(context.now.toISOString()).toZonedDateTimeISO(context.timeZone);
	const weekday = now.toLocaleString('en-US', { weekday: 'long' });
	const writable = context.calendars.filter(calendar => !calendar.readOnly);
	const defaultCalendar = writable.find(calendar => calendar.isDefault) ?? writable[0];
	const calendars = context.calendars.map(calendar => `- ${calendar.name} (id: ${calendar.id}${calendar.isDefault ? ', default' : ''}${calendar.readOnly ? ', read-only' : ''})`).join('\n');

	return `You are Tempi's calendar assistant. You help the user find, create, edit and delete events in their local calendar.

Context:
- Now: ${weekday}, ${localInstant(context.now, context.timeZone)} (time zone ${context.timeZone}).
- Weeks start on ${context.weekStart}.
- New events last ${context.defaultEventDuration} minutes unless the user says otherwise.
- The user's app language is ${LANGUAGE_NAMES[context.language]}. Reply in the language the user writes in.
- Calendars:
${calendars}
- Default calendar for new events: ${defaultCalendar === undefined ? 'none (events cannot be created)' : `${defaultCalendar.name} (id: ${defaultCalendar.id})`}.

Rules:
- Resolve relative dates ("tomorrow", "next Tuesday") from the current date above, in the user's time zone.
- Write every date-time as ISO-8601 with the user's UTC offset, e.g. 2026-11-18T15:00:00-05:00, and set timeZone to ${context.timeZone}.
- To answer questions about the schedule, call listEvents or searchEvents. Never invent events.
- To change the calendar, call createEvent, updateEvent or deleteEvent. They only propose the change: the user confirms it in the app. Never say a change was saved; say it is ready to confirm.
- To edit or delete, first find the event's id with listEvents or searchEvents.
- If something required is missing or ambiguous (title, day, or start time of an event that is not all-day), ask a short follow-up question instead of guessing.
- If a tool answers with issues, fix what you can and ask the user for the rest.
- Never put events in a read-only calendar. Keep answers short.${voice ? VOICE_RULES : ''}`;
};
