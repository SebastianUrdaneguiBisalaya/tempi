import type { CalendarEvent } from '../domain/event';
import { fail, ok, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';
import { writableCalendar } from './writable-calendar';

/** Undoes a delete: clears `deletedAt` so the event is back as it was. Restoring an event that isn't deleted changes nothing. */
export const restoreEvent = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events'>, id: string): Promise<Result<CalendarEvent>> => {
	const current = await deps.events.findById(id);
	if (current === null) return fail('not_found', 'event.notFound', { detail: `Event ${id} not found`, field: 'id' });
	if (current.deletedAt === null) return ok(current);

	// Deleting a calendar deletes its events; they can't come back without it.
	const calendar = await writableCalendar(deps, current.calendarId);
	if (!calendar.ok) return calendar;

	const event: CalendarEvent = { ...current, deletedAt: null, updatedAt: nowIso(deps.clock) };
	await deps.events.save(event);
	return ok(event);
};
