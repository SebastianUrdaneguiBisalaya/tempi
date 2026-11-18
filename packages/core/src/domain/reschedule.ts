import { MINUTES_PER_DAY } from './day-layout';

/** Start and end of an event, as UTC instants. */
export type TimeRange = { endAt: string; startAt: string };

/** Grid step for dragging and keyboard changes: times land on quarter hours. */
export const SNAP_MINUTES = 15;

const snap = (time: Temporal.ZonedDateTime): Temporal.ZonedDateTime => time.round({ roundingIncrement: SNAP_MINUTES, smallestUnit: 'minute' });

const toRange = (start: Temporal.ZonedDateTime, end: Temporal.ZonedDateTime): TimeRange => ({ endAt: end.toInstant().toString(), startAt: start.toInstant().toString() });

/** Wall-clock time `minute` minutes into `day` in `timeZone`; `MINUTES_PER_DAY` is the next midnight. */
export const wallTime = (day: Temporal.PlainDate, minute: number, timeZone: string): Temporal.ZonedDateTime => {
	const clamped = Math.min(Math.max(Math.round(minute), 0), MINUTES_PER_DAY);
	return day.add({ days: Math.floor(clamped / MINUTES_PER_DAY) }).toZonedDateTime({
		plainTime: Temporal.PlainTime.from({ hour: Math.floor((clamped % MINUTES_PER_DAY) / 60), minute: clamped % 60 }),
		timeZone,
	});
};

/**
 * Shifts a range by whole days (keeping its wall-clock time in `timeZone`) and by minutes, then snaps the start to
 * the grid. The duration doesn't change.
 */
export const moveRange = (range: TimeRange, by: { days: number; minutes: number }, timeZone: string): TimeRange => {
	const start = Temporal.Instant.from(range.startAt).toZonedDateTimeISO(timeZone);
	const duration = Temporal.Instant.from(range.startAt).until(Temporal.Instant.from(range.endAt));
	// Temporal only adds whole units; pointer drags measure fractional minutes.
	const moved = snap(start.add({ days: Math.round(by.days) }).add({ minutes: Math.round(by.minutes) }));
	return toRange(moved, moved.add(duration));
};

/** Sets a new end, snapped to the grid and kept at least one step after the start. The start doesn't change. */
export const resizeRange = (range: TimeRange, end: Temporal.ZonedDateTime): TimeRange => {
	const start = Temporal.Instant.from(range.startAt).toZonedDateTimeISO(end.timeZoneId);
	const snapped = snap(end);
	const shortest = start.add({ minutes: SNAP_MINUTES });
	return toRange(start, Temporal.ZonedDateTime.compare(snapped, shortest) < 0 ? shortest : snapped);
};

/** The range swept between two minutes of `day`, in either order, widened to whole grid steps (at least one). */
export const sweepRange = (day: Temporal.PlainDate, fromMinute: number, toMinute: number, timeZone: string): TimeRange => {
	const first = Math.floor(Math.min(fromMinute, toMinute) / SNAP_MINUTES) * SNAP_MINUTES;
	const last = Math.ceil(Math.max(fromMinute, toMinute) / SNAP_MINUTES) * SNAP_MINUTES;
	const start = Math.min(Math.max(first, 0), MINUTES_PER_DAY - SNAP_MINUTES);
	return toRange(wallTime(day, start, timeZone), wallTime(day, Math.max(last, start + SNAP_MINUTES), timeZone));
};
