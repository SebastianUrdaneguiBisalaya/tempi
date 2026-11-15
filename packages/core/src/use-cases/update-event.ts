import { type CalendarEvent, type EventPatch, eventFieldsSchema, eventPatchSchema } from '../domain/event';
import { fail, ok, parseWith, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';

export const updateEvent = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events'>, id: string, patch: EventPatch): Promise<Result<CalendarEvent>> => {
	const current = await deps.events.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'event.notFound', { detail: `Event ${id} not found`, field: 'id' });

	const changes = parseWith(eventPatchSchema, patch);
	if (!changes.ok) return changes;

	// Cross-field rules (end after start) only make sense on the merged event.
	const { createdAt, deletedAt, id: _id, updatedAt: _updatedAt, ...currentFields } = current;
	const fields = parseWith(eventFieldsSchema, { ...currentFields, ...changes.value });
	if (!fields.ok) return fields;

	if (fields.value.calendarId !== current.calendarId) {
		const calendar = await deps.calendars.findById(fields.value.calendarId);
		if (calendar === null || calendar.deletedAt !== null) return fail('not_found', 'calendar.notFound', { detail: `Calendar ${fields.value.calendarId} not found`, field: 'calendarId' });
	}

	const event: CalendarEvent = { ...fields.value, createdAt, deletedAt, id, updatedAt: nowIso(deps.clock) };
	await deps.events.save(event);
	return ok(event);
};
