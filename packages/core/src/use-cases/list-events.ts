import { type DateRange, dateRangeSchema } from '../domain/date-range';
import type { EventOccurrence } from '../domain/event';
import { occurrenceStarts } from '../domain/recurrence';
import { ok, parseWith, type Result } from '../domain/result';
import type { CoreDeps } from './deps';
import { seriesOccurrence, toOccurrence } from './occurrences';

/** Every occurrence overlapping the range, ordered by start: single events, edited occurrences and expanded series. */
export const listEvents = async (deps: Pick<CoreDeps, 'events'>, range: DateRange): Promise<Result<EventOccurrence[]>> => {
	const parsed = parseWith(dateRangeSchema, range);
	if (!parsed.ok) return parsed;

	const series = await deps.events.listSeries(parsed.value.end);
	const rules = new Map(series.map(event => [event.id, event.rrule]));
	const singles = await Promise.all(
		(await deps.events.listInRange(parsed.value)).map(async event => {
			if (event.recurringEventId === null) return toOccurrence(event);
			// An edited occurrence shows its series' recurrence, so its form edits the series it belongs to.
			const rrule = rules.has(event.recurringEventId) ? rules.get(event.recurringEventId) : (await deps.events.findById(event.recurringEventId))?.rrule;
			return { ...toOccurrence(event), rrule: rrule ?? null };
		})
	);
	const expanded = series.flatMap(series => (series.rrule === null ? [] : occurrenceStarts({ ...series, rrule: series.rrule }, parsed.value).map(start => seriesOccurrence(series, start))));
	return ok([...singles, ...expanded].sort((a, b) => a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt) || a.key.localeCompare(b.key)));
};
