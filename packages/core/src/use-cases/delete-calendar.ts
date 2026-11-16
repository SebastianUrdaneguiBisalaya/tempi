import { type DeleteCalendarInput, deleteCalendarInputSchema } from '../domain/calendar';
import { fail, ok, parseWith, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';

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
	if (current.isDefault) return fail('conflict', 'calendar.defaultNotDeletable', { detail: `Calendar ${id} is the default and cannot be deleted`, field: 'id' });

	const now = nowIso(deps.clock);
	if (moveEventsTo === null) await deps.events.softDeleteByCalendar(id, now);
	else {
		const target = moveEventsTo === id ? null : await deps.calendars.findById(moveEventsTo);
		if (target === null || target.deletedAt !== null)
			return fail('not_found', 'calendar.notFound', { detail: `Calendar ${moveEventsTo} can't receive the events of ${id}`, field: 'moveEventsTo' });
		await deps.events.moveToCalendar(id, moveEventsTo, now);
	}
	await deps.calendars.save({ ...current, deletedAt: now, updatedAt: now });
	return ok(null);
};
