import { type CalendarEvent, type EventPatch, validateEventFields } from '../domain/event';
import { fail, ok, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';

export const updateEvent = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events'>, id: string, patch: EventPatch): Promise<Result<CalendarEvent>> => {
	const current = await deps.events.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'Event not found', 'id');

	const { createdAt, deletedAt, id: _id, updatedAt: _updatedAt, ...currentFields } = current;
	const fields = validateEventFields({ ...currentFields, ...patch });
	if (!fields.ok) return fields;

	if (fields.value.calendarId !== current.calendarId) {
		const calendar = await deps.calendars.findById(fields.value.calendarId);
		if (calendar === null || calendar.deletedAt !== null) return fail('not_found', 'Calendar not found', 'calendarId');
	}

	const event: CalendarEvent = { ...fields.value, createdAt, deletedAt, id, updatedAt: nowIso(deps.clock) };
	await deps.events.save(event);
	return ok(event);
};
