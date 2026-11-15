import { fail, ok, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';

/** Soft-deletes a non-default calendar and all of its events. */
export const deleteCalendar = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events'>, id: string): Promise<Result<null>> => {
	const current = await deps.calendars.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'Calendar not found', 'id');
	if (current.isDefault) return fail('conflict', 'The default calendar cannot be deleted', 'id');

	const now = nowIso(deps.clock);
	await deps.events.softDeleteByCalendar(id, now);
	await deps.calendars.save({ ...current, deletedAt: now, updatedAt: now });
	return ok(null);
};
