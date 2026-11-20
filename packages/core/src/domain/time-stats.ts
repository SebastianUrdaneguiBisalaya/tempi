import { z } from 'zod';
import type { DateRange } from './date-range';
import { freeSlots } from './free-slots';
import type { WeekStart, WorkingHours } from './settings';
import { instantToUtc, plainDateSchema } from './values';

/** The longest period one report covers: three months, so a report stays a small, quick read. */
export const MAX_STATS_DAYS = 93;
/** Free stretches inside working hours at least this long count as focus time. */
export const FOCUS_MINUTES = 120;
/** How many series or titles the report ranks. */
export const TOP_ITEMS = 5;

/** A report over the days from `from` to `to`, both included, `YYYY-MM-DD` in the user's zone. */
export const timeStatsQuerySchema = z.object({ from: plainDateSchema, to: plainDateSchema }).superRefine((query, ctx) => {
	if (query.to < query.from) {
		ctx.addIssue({ code: 'custom', message: 'range.endBeforeStart', path: ['to'] });
		return;
	}
	const days = (() => {
		try {
			return Temporal.PlainDate.from(query.from).until(Temporal.PlainDate.from(query.to)).days + 1;
		} catch {
			return 0;
		}
	})();
	if (days > MAX_STATS_DAYS) ctx.addIssue({ code: 'too_big', input: days, maximum: MAX_STATS_DAYS, message: 'range.tooLong', origin: 'number', path: ['to'] });
});

export type TimeStatsQueryInput = z.input<typeof timeStatsQuerySchema>;
export type TimeStatsQuery = z.output<typeof timeStatsQuerySchema>;

const minutesSchema = z.number().int().nonnegative();
const calendarMinutesSchema = z.array(z.object({ calendarId: z.string(), minutes: minutesSchema }));
const totalsSchema = z.object({ averageMinutes: minutesSchema, events: minutesSchema, minutes: minutesSchema });

/**
 * Where the time of a period went. Every duration is in whole minutes. Busy time is the union of timed events, so an
 * hour with two events counts once, and each of its minutes goes to the calendar of the event that started first.
 */
export const timeStatsSchema = z.object({
	/** Busy minutes per calendar, most first. They add up to `totals.minutes`. */
	byCalendar: calendarMinutesSchema,
	/** The day with the most busy time, or null without any. */
	busiestDay: z.object({ date: z.string(), minutes: minutesSchema }).nullable(),
	from: z.string(),
	/** Busy minutes by weekday (0 is Monday) and hour of the day (0–23), summed over the period. */
	heatmap: z.array(z.array(minutesSchema).length(24)).length(7),
	/** Busy minutes on each of the next seven days from today. */
	nextWeek: z.array(z.object({ date: z.string(), minutes: minutesSchema })),
	/** The same totals over the period of the same length just before. */
	previous: totalsSchema,
	/** Timed occurrences that are part of a series, and those that aren't. */
	recurrence: z.object({ oneOff: minutesSchema, recurring: minutesSchema }),
	/** Timed occurrences by status. */
	status: z.object({ confirmed: minutesSchema, tentative: minutesSchema }),
	timeZone: z.string(),
	to: z.string(),
	/** The series or titles that took the most time (each occurrence's own length, overlaps included), most first. */
	top: z.array(z.object({ count: minutesSchema, minutes: minutesSchema, title: z.string() })),
	totals: totalsSchema,
	/** Timed occurrences with a video link, with only a place, and with neither. */
	venue: z.object({ inPerson: minutesSchema, none: minutesSchema, virtual: minutesSchema }),
	/** Busy minutes per week (by the user's week start), split by calendar. */
	weeks: z.array(z.object({ byCalendar: calendarMinutesSchema, start: z.string() })),
	/** Only while working hours are on: how full they were and how much focus time they left. */
	working: z.object({ busyMinutes: minutesSchema, focusMinutes: minutesSchema, minutes: minutesSchema }).nullable(),
});

export type TimeStats = z.output<typeof timeStatsSchema>;

/** What the report reads of each occurrence. */
export type StatsOccurrence = {
	allDay: boolean;
	calendarId: string;
	endAt: string;
	key: string;
	location: string | null;
	recurringEventId: string | null;
	series: { id: string } | null;
	startAt: string;
	status: 'confirmed' | 'tentative';
	title: string;
	videoUrl: string | null;
};

const FIRST_DAY: Record<WeekStart, number> = { monday: 1, saturday: 6, sunday: 7 };

export const weekStartOf = (date: Temporal.PlainDate, weekStart: WeekStart): Temporal.PlainDate => date.subtract({ days: (date.dayOfWeek - FIRST_DAY[weekStart] + 7) % 7 });

const startOfDay = (date: Temporal.PlainDate, timeZone: string): number => date.toZonedDateTime({ timeZone }).epochMilliseconds;

/** The UTC range of the days from `from` to `to`, both included, in `timeZone`. */
export const daysRange = (from: Temporal.PlainDate, to: Temporal.PlainDate, timeZone: string): DateRange => ({
	end: instantToUtc(Temporal.Instant.fromEpochMilliseconds(startOfDay(to.add({ days: 1 }), timeZone))),
	start: instantToUtc(Temporal.Instant.fromEpochMilliseconds(startOfDay(from, timeZone))),
});

/** The period of the same number of days just before the query's. */
export const previousPeriod = (query: TimeStatsQuery): { from: Temporal.PlainDate; to: Temporal.PlainDate } => {
	const from = Temporal.PlainDate.from(query.from);
	const days = from.until(Temporal.PlainDate.from(query.to)).days + 1;
	return { from: from.subtract({ days }), to: from.subtract({ days: 1 }) };
};

type Interval = { calendarId: string; end: number; order: string; start: number };

/** A busy stretch inside one local hour, owned by one calendar. */
type Segment = { calendarId: string; date: Temporal.PlainDate; end: number; hour: number; start: number };

const timedIn = (occurrences: readonly StatsOccurrence[], start: number, end: number): Interval[] =>
	occurrences.flatMap(occurrence => {
		if (occurrence.allDay) return [];
		const from = Math.max(start, Temporal.Instant.from(occurrence.startAt).epochMilliseconds);
		const to = Math.min(end, Temporal.Instant.from(occurrence.endAt).epochMilliseconds);
		return from < to ? [{ calendarId: occurrence.calendarId, end: to, order: `${occurrence.startAt}|${occurrence.key}`, start: from }] : [];
	});

/**
 * The busy time of the days from `from` to `to` cut at every local hour and every event edge, so each piece lies in
 * one hour of one day; a piece several events cover goes to the one that started first.
 */
const busySegments = (occurrences: readonly StatsOccurrence[], from: Temporal.PlainDate, to: Temporal.PlainDate, timeZone: string): Segment[] => {
	const start = startOfDay(from, timeZone);
	const end = startOfDay(to.add({ days: 1 }), timeZone);
	const intervals = timedIn(occurrences, start, end).sort((a, b) => a.order.localeCompare(b.order));
	if (intervals.length === 0) return [];
	const edges = new Set<number>();
	for (let hour = from.toZonedDateTime({ timeZone }); hour.epochMilliseconds < end; hour = hour.add({ hours: 1 })) edges.add(hour.epochMilliseconds);
	for (const interval of intervals) edges.add(interval.start).add(interval.end);
	edges.add(end);
	const sorted = [...edges].sort((a, b) => a - b);
	const segments: Segment[] = [];
	for (let index = 0; index < sorted.length - 1; index++) {
		const a = sorted[index] ?? 0;
		const b = sorted[index + 1] ?? 0;
		const owner = intervals.find(interval => interval.start <= a && interval.end >= b);
		if (owner === undefined) continue;
		const local = Temporal.Instant.fromEpochMilliseconds(a).toZonedDateTimeISO(timeZone);
		segments.push({ calendarId: owner.calendarId, date: local.toPlainDate(), end: b, hour: local.hour, start: a });
	}
	return segments;
};

const minutesOf = (ms: number): number => Math.round(ms / 60_000);

const sumBy = <K>(segments: readonly Segment[], keyOf: (segment: Segment) => K): Map<K, number> => {
	const sums = new Map<K, number>();
	for (const segment of segments) sums.set(keyOf(segment), (sums.get(keyOf(segment)) ?? 0) + segment.end - segment.start);
	return sums;
};

const calendarMinutes = (segments: readonly Segment[]) =>
	[...sumBy(segments, segment => segment.calendarId)]
		.map(([calendarId, ms]) => ({ calendarId, minutes: minutesOf(ms) }))
		.sort((a, b) => b.minutes - a.minutes || a.calendarId.localeCompare(b.calendarId));

const totalsOf = (occurrences: readonly StatsOccurrence[], segments: readonly Segment[], from: Temporal.PlainDate, to: Temporal.PlainDate, timeZone: string) => {
	const timed = timedIn(occurrences, startOfDay(from, timeZone), startOfDay(to.add({ days: 1 }), timeZone));
	const length = timed.reduce((sum, interval) => sum + interval.end - interval.start, 0);
	return {
		averageMinutes: timed.length === 0 ? 0 : minutesOf(length / timed.length),
		events: timed.length,
		minutes: minutesOf(segments.reduce((sum, segment) => sum + segment.end - segment.start, 0)),
	};
};

const dateList = (from: Temporal.PlainDate, to: Temporal.PlainDate): Temporal.PlainDate[] => {
	const dates: Temporal.PlainDate[] = [];
	for (let date = from; Temporal.PlainDate.compare(date, to) <= 0; date = date.add({ days: 1 })) dates.push(date);
	return dates;
};

export type TimeStatsInput = {
	/** Timed and all-day occurrences of the counted calendars over the period. */
	occurrences: readonly StatsOccurrence[];
	/** The same over the previous period and the next seven days. */
	previousOccurrences: readonly StatsOccurrence[];
	nextWeekOccurrences: readonly StatsOccurrence[];
	query: TimeStatsQuery;
	timeZone: string;
	today: Temporal.PlainDate;
	weekStart: WeekStart;
	workingHours: WorkingHours;
};

/** The report for the query's period; all-day events never count as busy time. */
export const timeStats = ({ nextWeekOccurrences, occurrences, previousOccurrences, query, timeZone, today, weekStart, workingHours }: TimeStatsInput): TimeStats => {
	const from = Temporal.PlainDate.from(query.from);
	const to = Temporal.PlainDate.from(query.to);
	const segments = busySegments(occurrences, from, to, timeZone);
	const totals = totalsOf(occurrences, segments, from, to, timeZone);
	const previous = previousPeriod(query);

	const byDay = sumBy(segments, segment => segment.date.toString());
	const busiest = [...byDay].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

	const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
	for (const [key, ms] of sumBy(segments, segment => `${segment.date.dayOfWeek - 1}:${segment.hour}`)) {
		const [weekday = 0, hour = 0] = key.split(':').map(Number);
		const row = heatmap[weekday];
		if (row !== undefined) row[hour] = minutesOf(ms);
	}

	const weekStarts = [...new Set(dateList(from, to).map(date => weekStartOf(date, weekStart).toString()))];
	const weeks = weekStarts.map(start => ({ byCalendar: calendarMinutes(segments.filter(segment => weekStartOf(segment.date, weekStart).toString() === start)), start }));

	const nextWeekEnd = today.add({ days: 6 });
	const nextByDay = sumBy(busySegments(nextWeekOccurrences, today, nextWeekEnd, timeZone), segment => segment.date.toString());

	const periodStart = startOfDay(from, timeZone);
	const periodEnd = startOfDay(to.add({ days: 1 }), timeZone);
	const timed = occurrences.filter(occurrence => timedIn([occurrence], periodStart, periodEnd).length > 0);
	const count = (test: (occurrence: StatsOccurrence) => boolean) => timed.filter(test).length;

	const groups = new Map<string, { count: number; ms: number; title: string }>();
	for (const occurrence of timed) {
		const key = occurrence.series?.id ?? occurrence.recurringEventId ?? `title:${occurrence.title.trim().toLowerCase()}`;
		const ms = timedIn([occurrence], periodStart, periodEnd).reduce((sum, interval) => sum + interval.end - interval.start, 0);
		const group = groups.get(key) ?? { count: 0, ms: 0, title: occurrence.title };
		groups.set(key, { count: group.count + 1, ms: group.ms + ms, title: group.title });
	}

	return {
		busiestDay: busiest === undefined ? null : { date: busiest[0], minutes: minutesOf(busiest[1]) },
		byCalendar: calendarMinutes(segments),
		from: query.from,
		heatmap,
		nextWeek: dateList(today, nextWeekEnd).map(date => ({ date: date.toString(), minutes: minutesOf(nextByDay.get(date.toString()) ?? 0) })),
		previous: totalsOf(previousOccurrences, busySegments(previousOccurrences, previous.from, previous.to, timeZone), previous.from, previous.to, timeZone),
		recurrence: {
			oneOff: count(occurrence => occurrence.series === null && occurrence.recurringEventId === null),
			recurring: count(occurrence => occurrence.series !== null || occurrence.recurringEventId !== null),
		},
		status: { confirmed: count(occurrence => occurrence.status === 'confirmed'), tentative: count(occurrence => occurrence.status === 'tentative') },
		timeZone,
		to: query.to,
		top: [...groups.values()]
			.sort((a, b) => b.ms - a.ms || a.title.localeCompare(b.title))
			.slice(0, TOP_ITEMS)
			.map(group => ({ count: group.count, minutes: minutesOf(group.ms), title: group.title })),
		totals,
		venue: {
			inPerson: count(occurrence => occurrence.videoUrl === null && occurrence.location !== null),
			none: count(occurrence => occurrence.videoUrl === null && occurrence.location === null),
			virtual: count(occurrence => occurrence.videoUrl !== null),
		},
		weeks,
		working: workingHours.enabled ? workingStats(segments, query, workingHours, timeZone) : null,
	};
};

/** Working time in the period, how much of it was busy, and the free stretches long enough to focus. */
const workingStats = (segments: readonly Segment[], query: TimeStatsQuery, workingHours: WorkingHours, timeZone: string) => {
	const windows = dateList(Temporal.PlainDate.from(query.from), Temporal.PlainDate.from(query.to))
		.filter(date => workingHours.days.includes(date.dayOfWeek))
		.map(date => ({
			end: date.toZonedDateTime({ plainTime: Temporal.PlainTime.from(workingHours.end), timeZone }).epochMilliseconds,
			start: date.toZonedDateTime({ plainTime: Temporal.PlainTime.from(workingHours.start), timeZone }).epochMilliseconds,
		}));
	const total = windows.reduce((sum, window) => sum + window.end - window.start, 0);
	const busy = segments.reduce((sum, segment) => sum + windows.reduce((inside, window) => inside + Math.max(0, Math.min(segment.end, window.end) - Math.max(segment.start, window.start)), 0), 0);
	const busyRanges = segments.map(segment => ({
		endAt: Temporal.Instant.fromEpochMilliseconds(segment.end).toString(),
		startAt: Temporal.Instant.fromEpochMilliseconds(segment.start).toString(),
	}));
	// The whole period counts, past days included, so the search starts before its first day.
	const searchFrom = Temporal.PlainDate.from(query.from).toZonedDateTime({ timeZone }).toInstant();
	const focus = freeSlots(busyRanges, { from: query.from, minMinutes: FOCUS_MINUTES, to: query.to }, workingHours, timeZone, searchFrom).days.reduce(
		(sum, day) => sum + day.slots.reduce((inside, slot) => inside + Temporal.Instant.from(slot.endAt).epochMilliseconds - Temporal.Instant.from(slot.startAt).epochMilliseconds, 0),
		0
	);
	return { busyMinutes: minutesOf(busy), focusMinutes: minutesOf(focus), minutes: minutesOf(total) };
};
