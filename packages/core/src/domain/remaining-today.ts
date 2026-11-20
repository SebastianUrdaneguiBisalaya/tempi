import type { DateRange } from './date-range';
import { instantToUtc } from './values';

type RemainingItem = { calendarId: string; endAt: string; startAt: string };

/** How many of today's events are left, and the next instant that number can change on its own. */
export type RemainingToday = { count: number; nextChangeAt: string };

/** Today in `timeZone`, from its local midnight to the next one (23 or 25 hours on a DST change). */
export const todayRange = (now: Temporal.Instant, timeZone: string): DateRange => {
	const start = now.toZonedDateTimeISO(timeZone).startOfDay();
	return { end: instantToUtc(start.add({ days: 1 }).toInstant()), start: instantToUtc(start.toInstant()) };
};

/**
 * The occurrences of visible calendars overlapping today in `timeZone` that haven't ended at `now`, all-day ones
 * included. An event still to start already counts, so the count only drops when one ends and only resets at midnight:
 * the next change is the earliest of those ends, or the next local midnight.
 */
export const remainingToday = (occurrences: readonly RemainingItem[], now: Temporal.Instant, timeZone: string, hiddenCalendarIds: ReadonlySet<string>): RemainingToday => {
	const today = todayRange(now, timeZone);
	const left = occurrences.filter(
		occurrence =>
			!hiddenCalendarIds.has(occurrence.calendarId) &&
			Temporal.Instant.compare(Temporal.Instant.from(occurrence.startAt), Temporal.Instant.from(today.end)) < 0 &&
			Temporal.Instant.compare(Temporal.Instant.from(occurrence.endAt), now) > 0
	);
	// Every end left is after `now`, so the next change is always ahead.
	const nextChangeAt = left.reduce((earliest, occurrence) => {
		const end = instantToUtc(Temporal.Instant.from(occurrence.endAt));
		return end < earliest ? end : earliest;
	}, today.end);
	return { count: left.length, nextChangeAt };
};
