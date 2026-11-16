import type { CalendarEvent } from '../domain/event';
import { fail, ok, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';

/**
 * Copies an event with every field, a new id and new timestamps. An edited occurrence copies its whole series. A
 * series copies its rule and its deleted dates; edited occurrences aren't copied, so the copy repeats on their
 * original dates as a plain occurrence.
 */
export const duplicateEvent = async (deps: Pick<CoreDeps, 'clock' | 'events' | 'ids'>, id: string): Promise<Result<CalendarEvent>> => {
	const found = await deps.events.findById(id);
	const source = found?.recurringEventId == null ? found : await deps.events.findById(found.recurringEventId);
	if (source === null || source === undefined || source.deletedAt !== null) return fail('not_found', 'event.notFound', { detail: `Event ${id} not found`, field: 'id' });

	const edited = source.rrule === null ? [] : await deps.events.listBySeries(source.id);
	const editedStarts = new Set(edited.map(event => event.originalStartAt));
	const exDates = source.exDates.filter(date => !editedStarts.has(date));

	const now = nowIso(deps.clock);
	const copy: CalendarEvent = { ...source, createdAt: now, exDates, deletedAt: null, id: deps.ids.next(), originalStartAt: null, recurringEventId: null, updatedAt: now };
	await deps.events.save(copy);
	return ok(copy);
};
