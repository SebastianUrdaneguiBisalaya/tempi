import { fail, ok, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';

/** Soft-deletes the event so the deletion can sync later. */
export const deleteEvent = async (deps: Pick<CoreDeps, 'clock' | 'events'>, id: string): Promise<Result<null>> => {
	const current = await deps.events.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'Event not found', 'id');

	const now = nowIso(deps.clock);
	await deps.events.save({ ...current, deletedAt: now, updatedAt: now });
	return ok(null);
};
