import { type CalendarEvent, type NewEventInput, newEventInputSchema } from '../domain/event';
import { fail, ok, parseWith, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';

export const createEvent = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'ids'>, input: NewEventInput): Promise<Result<CalendarEvent>> => {
	const fields = parseWith(newEventInputSchema, input);
	if (!fields.ok) return fields;

	const calendar = await deps.calendars.findById(fields.value.calendarId);
	if (calendar === null || calendar.deletedAt !== null) return fail('not_found', 'calendar.notFound', { detail: `Calendar ${fields.value.calendarId} not found`, field: 'calendarId' });

	const now = nowIso(deps.clock);
	const event: CalendarEvent = { ...fields.value, createdAt: now, deletedAt: null, id: deps.ids.next(), updatedAt: now };
	await deps.events.save(event);
	return ok(event);
};
