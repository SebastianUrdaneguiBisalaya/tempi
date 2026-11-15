import { type DateRange, dateRangeSchema } from '../domain/date-range';
import type { CalendarEvent } from '../domain/event';
import { ok, parseWith, type Result } from '../domain/result';
import type { CoreDeps } from './deps';

/** Non-deleted events overlapping the range, ordered by start. */
export const listEvents = async (deps: Pick<CoreDeps, 'events'>, range: DateRange): Promise<Result<CalendarEvent[]>> => {
	const parsed = parseWith(dateRangeSchema, range);
	if (!parsed.ok) return parsed;

	const events = await deps.events.listInRange(parsed.value);
	return ok(events.filter(event => event.deletedAt === null).sort((a, b) => a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt)));
};
