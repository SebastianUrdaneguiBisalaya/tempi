import { ok, parseWith, type Result } from '../domain/result';
import { daysRange, previousPeriod, type TimeStats, type TimeStatsQueryInput, timeStats, timeStatsQuerySchema } from '../domain/time-stats';
import type { CoreDeps } from './deps';
import { getSettings } from './get-settings';
import { listEvents } from './list-events';

/** Where the time of a period went, in `timeZone`, over the visible calendars only. */
export const getTimeStats = async (
	deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'settings'>,
	input: TimeStatsQueryInput,
	now: Temporal.Instant,
	timeZone: string
): Promise<Result<TimeStats>> => {
	const parsed = parseWith(timeStatsQuerySchema, input);
	if (!parsed.ok) return parsed;
	const query = parsed.value;
	const { weekStart, workingHours } = await getSettings(deps);
	const visible = new Set((await deps.calendars.list()).filter(calendar => calendar.isVisible).map(calendar => calendar.id));
	const today = now.toZonedDateTimeISO(timeZone).toPlainDate();
	const previous = previousPeriod(query);

	const ranges = [
		daysRange(Temporal.PlainDate.from(query.from), Temporal.PlainDate.from(query.to), timeZone),
		daysRange(previous.from, previous.to, timeZone),
		daysRange(today, today.add({ days: 6 }), timeZone),
	];
	const lists = [];
	for (const range of ranges) {
		const listed = await listEvents(deps, range);
		if (!listed.ok) return listed;
		lists.push(listed.value.filter(occurrence => visible.has(occurrence.calendarId)));
	}
	const [occurrences = [], previousOccurrences = [], nextWeekOccurrences = []] = lists;
	return ok(timeStats({ nextWeekOccurrences, occurrences, previousOccurrences, query, timeZone, today, weekStart, workingHours }));
};
