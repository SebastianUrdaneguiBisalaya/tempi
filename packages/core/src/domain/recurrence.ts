import { RRuleTemporal } from 'rrule-temporal';
import { z } from 'zod';
import type { DateRange } from './date-range';
import type { CalendarEvent } from './event';
import { instantToUtc } from './values';

// Recurrence is stored as RFC 5545 RRULE text without the `RRULE:` prefix and expanded on read in the event's own
// time zone, so occurrences keep their wall-clock time across DST changes.

/** Rule parts as an ordered map (`FREQ` → `WEEKLY`). */
type RruleParts = Map<string, string>;

const parseParts = (rrule: string): RruleParts => new Map(rrule.split(';').map(part => part.split('=', 2) as [string, string]));

const formatParts = (parts: RruleParts): string => [...parts].map(([key, value]) => `${key}=${value}`).join(';');

/** An RFC 5545 UTC date-time: `20260310T140000Z`. */
const formatUtc = (instant: Temporal.Instant): string => instant.toString({ smallestUnit: 'second' }).replace(/[-:]/g, '');

const zoned = (instant: string, timeZone: string): Temporal.ZonedDateTime => Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);

type SeriesRule = Pick<CalendarEvent, 'exDates' | 'startAt' | 'timeZone'> & { rrule: string };

// DTSTART always counts as the first occurrence (RFC 5545 §3.8.5.3), even when it doesn't match the rule's pattern.
const ruleOf = (series: SeriesRule, withExDates = true): RRuleTemporal =>
	new RRuleTemporal({
		dtstart: zoned(series.startAt, series.timeZone),
		exDate: withExDates ? series.exDates.map(instant => zoned(instant, series.timeZone)) : [],
		includeDtstart: true,
		rruleString: series.rrule,
	});

/** True when the text is a rule this app can expand. */
export const isValidRrule = (rrule: string): boolean => {
	try {
		ruleOf({ exDates: [], rrule, startAt: '2026-01-01T00:00:00Z', timeZone: 'UTC' }).next();
		return true;
	} catch {
		return false;
	}
};

/** True when `startAt` is one of the series' occurrences, counting excluded ones. */
export const isOccurrenceStart = (series: SeriesRule, startAt: string): boolean => ruleOf(series, false).matches(zoned(startAt, series.timeZone));

/** Starts (UTC) of the series' occurrences that overlap the range, excluded dates left out. */
export const occurrenceStarts = (series: SeriesRule & Pick<CalendarEvent, 'endAt'>, range: DateRange): string[] => {
	const duration = Temporal.Instant.from(series.startAt).until(Temporal.Instant.from(series.endAt));
	// Overlap means start < range end and start + duration > range start; `between` is exclusive at both ends.
	const after = Temporal.Instant.from(range.start).subtract(duration).toZonedDateTimeISO(series.timeZone);
	const before = zoned(range.end, series.timeZone);
	return ruleOf(series)
		.between(after, before, false)
		.map(start => instantToUtc(start.toInstant()));
};

/**
 * Start (UTC) of the occurrence in progress or next to come at `now`; once the series has ended, of its last
 * occurrence. Null only when every occurrence is excluded.
 */
export const upcomingOccurrenceStart = (series: SeriesRule & Pick<CalendarEvent, 'endAt'>, now: string): string | null => {
	const duration = Temporal.Instant.from(series.startAt).until(Temporal.Instant.from(series.endAt));
	const rule = ruleOf(series);
	// An occurrence still in progress started less than its duration ago.
	const upcoming = rule.next(Temporal.Instant.from(now).subtract(duration).toZonedDateTimeISO(series.timeZone), false) ?? rule.previous(zoned(now, series.timeZone), true);
	return upcoming === null ? null : instantToUtc(upcoming.toInstant());
};

/**
 * Splits a rule at an occurrence: the head ends right before `splitAt` and the tail is the same rule for the
 * occurrences from `splitAt` on. A `COUNT` is shared between the two so the series keeps its total.
 */
export const splitRrule = (series: SeriesRule, splitAt: string): { head: string; tail: string } => {
	const parts = parseParts(series.rrule);
	const head = new Map(parts);
	head.delete('COUNT');
	head.delete('UNTIL');
	head.set('UNTIL', formatUtc(Temporal.Instant.from(splitAt).subtract({ seconds: 1 })));

	const count = parts.get('COUNT');
	if (count === undefined) return { head: formatParts(head), tail: series.rrule };
	const tail = new Map(parts);
	const before = ruleOf(series, false).between(zoned(series.startAt, series.timeZone), zoned(splitAt, series.timeZone), true).length - 1;
	tail.set('COUNT', String(Math.max(Number(count) - before, 1)));
	return { head: formatParts(head), tail: formatParts(tail) };
};

// What the event form edits. `toRrule` turns it into a rule for a given start; `fromRrule` reads one back.

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
/** RFC 5545 weekdays in ISO order: index + 1 is Temporal's `dayOfWeek`. */
export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
/** Monthly on the start's day of the month (the 14th), or on its weekday of the month (the 2nd Tuesday). */
export const MONTHLY_MODES = ['dayOfMonth', 'weekdayOfMonth'] as const;
export const RECURRENCE_ENDS = ['never', 'until', 'count'] as const;
/** The event form's repeat choices; `custom` opens the full editor. */
export const RECURRENCE_PRESETS = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'] as const;

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
export type Weekday = (typeof WEEKDAYS)[number];
export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];

const MAX_REPEAT = 999;

export const recurrenceSchema = z
	.object({
		count: z.number().int('validation.integer').min(1, 'validation.min').max(MAX_REPEAT, 'validation.max'),
		ends: z.enum(RECURRENCE_ENDS),
		frequency: z.enum(RECURRENCE_FREQUENCIES),
		interval: z.number().int('validation.integer').min(1, 'validation.min').max(MAX_REPEAT, 'validation.max'),
		monthlyMode: z.enum(MONTHLY_MODES),
		/** Last day (inclusive, `YYYY-MM-DD`) when `ends` is `until`. */
		until: z.string(),
		/** Days of a weekly rule; empty means the start's weekday. */
		weekdays: z.array(z.enum(WEEKDAYS)),
	})
	.superRefine((recurrence, ctx) => {
		if (recurrence.ends !== 'until') return;
		try {
			Temporal.PlainDate.from(recurrence.until);
		} catch {
			ctx.addIssue({ code: 'custom', message: recurrence.until === '' ? 'validation.required' : 'validation.invalid_format', path: ['until'] });
		}
	});

export type Recurrence = z.output<typeof recurrenceSchema>;

/** `recurrenceSchema` for an event starting on `start`: an end date can't come before it. */
export const recurrenceSchemaFor = (start: Temporal.PlainDate) =>
	recurrenceSchema.refine(
		recurrence => recurrence.ends !== 'until' || !/^\d{4}-\d{2}-\d{2}$/.test(recurrence.until) || Temporal.PlainDate.compare(Temporal.PlainDate.from(recurrence.until), start) >= 0,
		{
			message: 'recurrence.untilBeforeStart',
			path: ['until'],
		}
	);

const weekdayOf = (date: Temporal.PlainDate): Weekday => WEEKDAYS[date.dayOfWeek - 1] ?? 'MO';

/**
 * Which weekday of its month a date is: the 2nd Tuesday is `{ nth: 2, weekday: 'TU' }`. A weekday in the last week of
 * its month is `-1` (last), so a monthly rule built on it exists every month.
 */
export const monthWeekday = (date: Temporal.PlainDate): { nth: -1 | 1 | 2 | 3 | 4; weekday: Weekday } => ({
	nth: date.day + 7 > date.daysInMonth ? -1 : (Math.ceil(date.day / 7) as 1 | 2 | 3 | 4),
	weekday: weekdayOf(date),
});

/** `2TU` for the 2nd Tuesday, `-1FR` for the last Friday. */
const weekdayOfMonth = (date: Temporal.PlainDate): string => {
	const { nth, weekday } = monthWeekday(date);
	return `${nth}${weekday}`;
};

/** The recurrence a preset stands for, starting on `start`. */
export const presetRecurrence = (frequency: RecurrenceFrequency, start: Temporal.PlainDate): Recurrence => ({
	count: 10,
	ends: 'never',
	frequency,
	interval: 1,
	monthlyMode: 'dayOfMonth',
	until: start.add({ months: 1 }).toString(),
	weekdays: [weekdayOf(start)],
});

/** The rule for a recurrence of an event starting at `start`; `until` is the end of that day in the event's zone. */
export const toRrule = (recurrence: Recurrence, start: Temporal.ZonedDateTime): string => {
	const parts: RruleParts = new Map([['FREQ', recurrence.frequency]]);
	if (recurrence.interval > 1) parts.set('INTERVAL', String(recurrence.interval));
	const date = start.toPlainDate();
	if (recurrence.frequency === 'WEEKLY') {
		const days = WEEKDAYS.filter(day => recurrence.weekdays.includes(day));
		// Only the start's own weekday is the rule's default; leaving it implicit keeps it following the start.
		if (days.length > 0 && !(days.length === 1 && days[0] === weekdayOf(date))) parts.set('BYDAY', days.join(','));
	}
	if (recurrence.frequency === 'MONTHLY' && recurrence.monthlyMode === 'weekdayOfMonth') parts.set('BYDAY', weekdayOfMonth(date));
	if (recurrence.ends === 'count') parts.set('COUNT', String(recurrence.count));
	if (recurrence.ends === 'until') {
		const lastMoment = Temporal.PlainDate.from(recurrence.until).add({ days: 1 }).toZonedDateTime({ timeZone: start.timeZoneId }).subtract({ seconds: 1 });
		parts.set('UNTIL', formatUtc(lastMoment.toInstant()));
	}
	return formatParts(parts);
};

const SUPPORTED_PARTS = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL']);
const isFrequency = (value: string | undefined): value is RecurrenceFrequency => RECURRENCE_FREQUENCIES.some(frequency => frequency === value);
const isWeekday = (value: string): value is Weekday => WEEKDAYS.some(day => day === value);

/** Reads a rule back as the form's recurrence, or null when it uses parts the form can't show (it then stays as is). */
export const fromRrule = (rrule: string, start: Temporal.ZonedDateTime): Recurrence | null => {
	const parts = parseParts(rrule);
	const frequency = parts.get('FREQ');
	if (!isFrequency(frequency) || [...parts.keys()].some(key => !SUPPORTED_PARTS.has(key))) return null;
	const date = start.toPlainDate();
	const recurrence: Recurrence = { ...presetRecurrence(frequency, date), interval: Number(parts.get('INTERVAL') ?? 1) };

	const byDay = parts.get('BYDAY')?.split(',') ?? [];
	if (frequency === 'WEEKLY' && byDay.length > 0) {
		if (!byDay.every(isWeekday)) return null;
		recurrence.weekdays = byDay.filter(isWeekday);
	} else if (frequency === 'MONTHLY' && byDay.length > 0) {
		if (byDay.length !== 1 || byDay[0] !== weekdayOfMonth(date)) return null;
		recurrence.monthlyMode = 'weekdayOfMonth';
	} else if (byDay.length > 0) return null;

	const count = parts.get('COUNT');
	const until = parts.get('UNTIL');
	if (count !== undefined) Object.assign(recurrence, { count: Number(count), ends: 'count' });
	else if (until !== undefined) {
		const instant = Temporal.Instant.from(until.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
		Object.assign(recurrence, { ends: 'until', until: instant.toZonedDateTimeISO(start.timeZoneId).toPlainDate().toString() });
	}
	return recurrenceSchema.safeParse(recurrence).success ? recurrence : null;
};

/** Which repeat choice a stored rule shows as: a preset when it is exactly one, else custom. */
export const presetOf = (rrule: string | null, start: Temporal.ZonedDateTime): RecurrencePreset => {
	if (rrule === null) return 'none';
	const preset = RECURRENCE_FREQUENCIES.find(frequency => toRrule(presetRecurrence(frequency, start.toPlainDate()), start) === rrule);
	return preset === undefined ? 'custom' : (preset.toLowerCase() as Lowercase<RecurrenceFrequency>);
};
