import { type DeleteCalendarInput, deleteCalendarInputSchema } from '../domain/calendar';
import { fail, ok, parseWith, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';
import { writableCalendar } from './writable-calendar';

/**
 * Soft-deletes a non-default calendar. Its events move to `moveEventsTo` (every row, so recurring series keep their
 * edited occurrences) or, when it is null, are deleted with it.
 */
export const deleteCalendar = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events'>, input: DeleteCalendarInput): Promise<Result<null>> => {
	const parsed = parseWith(deleteCalendarInputSchema, input);
	if (!parsed.ok) return parsed;
	const { id, moveEventsTo } = parsed.value;

	const current = await deps.calendars.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'calendar.notFound', { detail: `Calendar ${id} not found`, field: 'id' });
	if (current.source !== 'local') return fail('conflict', 'calendar.synced', { detail: `Calendar ${id} is synced from ${current.source}`, field: 'id' });
	if (current.isDefault) return fail('conflict', 'calendar.defaultNotDeletable', { detail: `Calendar ${id} is the default and cannot be deleted`, field: 'id' });

	const now = nowIso(deps.clock);
	if (moveEventsTo === null) await deps.events.softDeleteByCalendar(id, now);
	else {
		if (moveEventsTo === id) return fail('not_found', 'calendar.notFound', { detail: `Calendar ${id} can't receive its own events`, field: 'moveEventsTo' });
		const target = await writableCalendar(deps, moveEventsTo, 'moveEventsTo');
		if (!target.ok) return target;
		await deps.events.moveToCalendar(id, moveEventsTo, now);
	}
	await deps.calendars.save({ ...current, deletedAt: now, updatedAt: now });
	return ok(null);
};
