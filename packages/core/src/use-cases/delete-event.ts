import { fail, ok, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';
import { writableCalendar } from './writable-calendar';

/** Soft-deletes the event so the deletion can sync later. */
export const deleteEvent = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events'>, id: string): Promise<Result<null>> => {
	const current = await deps.events.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'event.notFound', { detail: `Event ${id} not found`, field: 'id' });

	const calendar = await writableCalendar(deps, current.calendarId);
	if (!calendar.ok) return calendar;

	const now = nowIso(deps.clock);
	await deps.events.save({ ...current, deletedAt: now, updatedAt: now });
	return ok(null);
};
