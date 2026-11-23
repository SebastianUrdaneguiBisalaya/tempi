import { type CalendarEvent, type NewEventInput, NO_SERIES, newEventInputSchema } from '../domain/event';
import { ok, parseWith, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';
import { allowsGoogleFields, writableCalendar } from './writable-calendar';

export const createEvent = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'ids'>, input: NewEventInput): Promise<Result<CalendarEvent>> => {
	const fields = parseWith(newEventInputSchema, input);
	if (!fields.ok) return fields;

	const calendar = await writableCalendar(deps, fields.value.calendarId);
	if (!calendar.ok) return calendar;
	const google = allowsGoogleFields(calendar.value, fields.value);
	if (!google.ok) return google;

	const now = nowIso(deps.clock);
	const event: CalendarEvent = { ...fields.value, ...NO_SERIES, createdAt: now, deletedAt: null, id: deps.ids.next(), updatedAt: now };
	await deps.events.save(event);
	return ok(event);
};
