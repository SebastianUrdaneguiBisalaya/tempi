import { type CalendarEvent, type EventPatch, eventFieldsSchema, eventPatchSchema } from '../domain/event';
import { fail, ok, parseWith, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';
import { allowsGoogleFields, allowsGuestChange, writableCalendar } from './writable-calendar';

export const updateEvent = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events'>, id: string, patch: EventPatch): Promise<Result<CalendarEvent>> => {
	const current = await deps.events.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'event.notFound', { detail: `Event ${id} not found`, field: 'id' });

	const source = await writableCalendar(deps, current.calendarId);
	if (!source.ok) return source;

	const changes = parseWith(eventPatchSchema, patch);
	if (!changes.ok) return changes;

	// Cross-field rules (end after start) only make sense on the merged event.
	const { createdAt, deletedAt, id: _id, updatedAt: _updatedAt, ...currentFields } = current;
	const fields = parseWith(eventFieldsSchema, { ...currentFields, ...changes.value });
	if (!fields.ok) return fields;

	const target = fields.value.calendarId === current.calendarId ? source : await writableCalendar(deps, fields.value.calendarId);
	if (!target.ok) return target;
	const google = allowsGoogleFields(target.value, fields.value);
	if (!google.ok) return google;
	const guests = allowsGuestChange(current, changes.value.guests);
	if (!guests.ok) return guests;

	const event: CalendarEvent = { ...fields.value, createdAt, deletedAt, id, updatedAt: nowIso(deps.clock) };
	await deps.events.save(event);
	return ok(event);
};
