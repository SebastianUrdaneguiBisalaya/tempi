import { formatTimeZoneOffset } from './date-format';
import type { Locale } from './i18n';

/**
 * The sample week every mockup on the landing shows, so the time grid, the shared availability and the time stats all
 * read the same events. Days are offsets from the visitor's today and hours are local decimal hours (15.5 is 15:30).
 * The free time and stats below follow the rules of `@tempi/core` (`freeSlots`, `timeStats`) over this data.
 */
export const CALENDARS = {
	work: '#3b82f6',
	personal: '#22c55e',
	project: '#8b5cf6',
	holidays: '#f97316',
} as const;

export type CalendarKey = keyof typeof CALENDARS;

type SampleEvent = {
	key: string;
	calendar: CalendarKey;
	/** Days from today, so the visitor's today always has events. */
	day: number;
	start: number;
	end: number;
	location?: boolean;
	video?: boolean;
	/** An occurrence of a repeating series. */
	recurring?: boolean;
};

export const EVENTS = [
	{ key: 'reading', calendar: 'personal', day: -3, start: 15.5, end: 16.5 },
	{ key: 'gym', calendar: 'personal', day: -2, start: 8, end: 9, recurring: true },
	{ key: 'research', calendar: 'project', day: -2, start: 10, end: 12 },
	{ key: 'standup', calendar: 'work', day: -1, start: 9, end: 9.5, video: true, recurring: true },
	{ key: 'oneOnOne', calendar: 'work', day: -1, start: 11, end: 11.5, video: true },
	{ key: 'planning', calendar: 'work', day: -1, start: 14, end: 15.5 },
	{ key: 'designReview', calendar: 'work', day: 0, start: 9, end: 10, location: true },
	{ key: 'lunch', calendar: 'personal', day: 0, start: 11.5, end: 12.5 },
	{ key: 'teamSync', calendar: 'work', day: 0, start: 13, end: 14, video: true },
	{ key: 'focus', calendar: 'project', day: 0, start: 15, end: 16.5 },
	{ key: 'standup', calendar: 'work', day: 1, start: 9, end: 9.5, video: true, recurring: true },
	{ key: 'docs', calendar: 'project', day: 1, start: 10, end: 11.5 },
	{ key: 'call', calendar: 'personal', day: 1, start: 15.5, end: 16.5 },
	{ key: 'gym', calendar: 'personal', day: 2, start: 8, end: 9, recurring: true },
	{ key: 'codeReview', calendar: 'project', day: 2, start: 11, end: 12 },
	{ key: 'dentist', calendar: 'personal', day: 2, start: 15, end: 16 },
	{ key: 'release', calendar: 'project', day: 3, start: 11, end: 12.5 },
	{ key: 'retro', calendar: 'work', day: 3, start: 15, end: 16 },
] as const satisfies readonly SampleEvent[];

/**
 * Anchored to a weekday (`Date.getDay()`, 0 = Sunday) instead of today, so the week's edges aren't empty
 * when today sits late or early in the week. They only fill days the relative events above leave free.
 */
const WEEKDAY_EVENTS = [
	{ key: 'walkDog', calendar: 'personal', weekday: 0, start: 9, end: 10 },
	{ key: 'familyVisit', calendar: 'personal', weekday: 0, start: 12.5, end: 15 },
	{ key: 'weeklyPlanning', calendar: 'work', weekday: 1, start: 9, end: 10, recurring: true },
	{ key: 'gaming', calendar: 'personal', weekday: 1, start: 15.5, end: 17 },
] as const satisfies readonly (Omit<SampleEvent, 'day'> & { weekday: number })[];

/** One public holiday from the read-only calendar; all-day events never block time or count in stats. */
export const ALL_DAY = { key: 'holiday', calendar: 'holidays', day: 4 } as const;

type TimedKey = (typeof EVENTS)[number]['key'] | (typeof WEEKDAY_EVENTS)[number]['key'];

export type EventKey = TimedKey | typeof ALL_DAY.key;

/** A timed sample event on one day. */
export type DayEvent = { key: TimedKey; calendar: CalendarKey; start: number; end: number; location?: boolean; video?: boolean; recurring?: boolean };

/** "Now" is fixed at 12:35, so the Upcoming panel always reads "in 25 minutes" for the team sync. */
export const NOW_HOUR = 12 + 35 / 60;

/** Tempi's default working hours (09:00–18:00, Monday to Friday), turned on. Weekdays are ISO: 1 is Monday. */
export const WORKING_HOURS = { days: [1, 2, 3, 4, 5], start: 9, end: 18 } as const;

// The secondary time zone set in Settings › Calendar: the first whose offset differs from the visitor's today.
const SECONDARY_ZONES = ['Europe/London', 'America/New_York', 'Asia/Tokyo'] as const;

export const secondaryZone = (today: Date, locale: Locale) => SECONDARY_ZONES.find(zone => formatTimeZoneOffset(today, locale, zone) !== formatTimeZoneOffset(today, locale));

/** Shortest free slot the availability search lists by default, and the free stretch that counts as focus time. */
const MIN_FREE_HOURS = 0.5;
const FOCUS_HOURS = 2;

/** `Date#getDay` of the first weekday: Sunday in English, Monday in Spanish, like the app's default for each language. */
export const weekStartFor = (locale: Locale): 0 | 1 => (locale === 'es' ? 1 : 0);

export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** `date` at a decimal hour of its day. */
export const at = (date: Date, hour: number) => {
	const copy = new Date(date);
	copy.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
	return copy;
};

/** Monday is 1 and Sunday 7, like `Temporal.PlainDate#dayOfWeek`. */
export const isoWeekday = (date: Date) => (date.getDay() === 0 ? 7 : date.getDay());

/** The offset from today of the first day of today's week. */
export const weekStartOffset = (today: Date, weekStart: 0 | 1) => -((today.getDay() - weekStart + 7) % 7);

const isWorkingDay = (today: Date, day: number) => WORKING_HOURS.days.some(weekday => weekday === isoWeekday(addDays(today, day)));

/** The timed events of the day `day` days from today, by start; before hydration (no `today`), the relative ones only. */
export const eventsOn = (today: Date | null, day: number): DayEvent[] => {
	const relative: DayEvent[] = EVENTS.filter(event => event.day === day);
	if (relative.length > 0 || today === null) return relative.sort((a, b) => a.start - b.start);
	const weekday = addDays(today, day).getDay();
	return WEEKDAY_EVENTS.filter(event => event.weekday === weekday).sort((a, b) => a.start - b.start);
};

type Span = { start: number; end: number };

const hoursToMinutes = (hours: number) => Math.round(hours * 60);

/** The stretches of `window` no event covers, at least `minimum` hours long. Sample events never overlap. */
const gaps = (today: Date, day: number, window: Span, minimum: number): Span[] => {
	const free: Span[] = [];
	let cursor = window.start;
	for (const event of eventsOn(today, day)) {
		if (event.end <= cursor || event.start >= window.end) continue;
		if (event.start - cursor >= minimum) free.push({ start: cursor, end: event.start });
		cursor = Math.max(cursor, event.end);
	}
	if (window.end - cursor >= minimum) free.push({ start: cursor, end: window.end });
	return free;
};

export type FreeDay = { day: number; slots: Span[] };

/** The days the "This week" and "Next week" presets cover: the rest of this week from today, or the whole next week. */
export const presetRange = (range: 'thisWeek' | 'nextWeek', today: Date, weekStart: 0 | 1) => {
	const first = weekStartOffset(today, weekStart);
	return range === 'thisWeek' ? { from: 0, to: first + 6 } : { from: first + 7, to: first + 13 };
};

/** Free time of each working day from `from` to `to`: working hours from now on, minus every timed event, slots of 30 minutes or more. */
export const freeSlots = (today: Date, { from, to }: { from: number; to: number }): FreeDay[] => {
	const days: FreeDay[] = [];
	for (let day = from; day <= to; day++) {
		if (!isWorkingDay(today, day)) continue;
		const start = day < 0 ? WORKING_HOURS.end : day === 0 ? Math.max(WORKING_HOURS.start, NOW_HOUR) : WORKING_HOURS.start;
		days.push({ day, slots: start >= WORKING_HOURS.end ? [] : gaps(today, day, { start, end: WORKING_HOURS.end }, MIN_FREE_HOURS) });
	}
	return days;
};

type Totals = { minutes: number; events: number; averageMinutes: number };

export type WeekStats = {
	totals: Totals;
	previous: Totals;
	busiestDay: { day: number; minutes: number } | null;
	byCalendar: { calendar: CalendarKey; minutes: number }[];
	/** Busy minutes by weekday (row 0 is Monday) and hour. */
	heatmap: number[][];
	venue: { virtual: number; inPerson: number; none: number };
	recurrence: { recurring: number; oneOff: number };
	status: { confirmed: number; tentative: number };
	top: { key: TimedKey; count: number; minutes: number }[];
	nextWeek: { day: number; minutes: number }[];
	working: { minutes: number; busyMinutes: number; focusMinutes: number };
};

const TOP_ITEMS = 5;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

const eventsIn = (today: Date, from: number, to: number) => range(from, to).flatMap(day => eventsOn(today, day).map(event => ({ ...event, day })));

const totalsOf = (events: readonly DayEvent[]): Totals => {
	const minutes = events.reduce((sum, event) => sum + hoursToMinutes(event.end - event.start), 0);
	return { minutes, events: events.length, averageMinutes: events.length === 0 ? 0 : Math.round(minutes / events.length) };
};

const busyMinutes = (today: Date, day: number) => totalsOf(eventsOn(today, day)).minutes;

/** The "Week" period of the time stats drawer: today's week, compared with the week before, with working hours on. */
export const weekStats = (today: Date, weekStart: 0 | 1): WeekStats => {
	const first = weekStartOffset(today, weekStart);
	const days = range(first, first + 6);
	const events = eventsIn(today, first, first + 6);

	const busiest = days
		.map(day => ({ day, minutes: busyMinutes(today, day) }))
		.filter(entry => entry.minutes > 0)
		.sort((a, b) => b.minutes - a.minutes || a.day - b.day)[0];

	const byCalendar = (Object.keys(CALENDARS) as CalendarKey[])
		.map(calendar => ({ calendar, minutes: totalsOf(events.filter(event => event.calendar === calendar)).minutes }))
		.filter(entry => entry.minutes > 0)
		.sort((a, b) => b.minutes - a.minutes || a.calendar.localeCompare(b.calendar));

	const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
	for (const event of events) {
		const row = heatmap[isoWeekday(addDays(today, event.day)) - 1];
		for (let hour = Math.floor(event.start); hour < event.end; hour++) {
			const inside = Math.min(event.end, hour + 1) - Math.max(event.start, hour);
			if (row !== undefined && inside > 0) row[hour] = (row[hour] ?? 0) + hoursToMinutes(inside);
		}
	}

	const groups = new Map<TimedKey, { count: number; minutes: number }>();
	for (const event of events) {
		const group = groups.get(event.key) ?? { count: 0, minutes: 0 };
		groups.set(event.key, { count: group.count + 1, minutes: group.minutes + hoursToMinutes(event.end - event.start) });
	}

	const workingDays = days.filter(day => isWorkingDay(today, day));
	const window = { start: WORKING_HOURS.start, end: WORKING_HOURS.end };
	const overlap = (event: Span) => Math.max(0, Math.min(event.end, window.end) - Math.max(event.start, window.start));

	return {
		totals: totalsOf(events),
		previous: totalsOf(eventsIn(today, first - 7, first - 1)),
		busiestDay: busiest ?? null,
		byCalendar,
		heatmap,
		venue: {
			virtual: events.filter(event => event.video === true).length,
			inPerson: events.filter(event => event.video !== true && event.location === true).length,
			none: events.filter(event => event.video !== true && event.location !== true).length,
		},
		recurrence: { recurring: events.filter(event => event.recurring === true).length, oneOff: events.filter(event => event.recurring !== true).length },
		status: { confirmed: events.length, tentative: 0 },
		top: [...groups]
			.map(([key, group]) => ({ key, ...group }))
			.sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key))
			.slice(0, TOP_ITEMS),
		nextWeek: range(0, 6).map(day => ({ day, minutes: busyMinutes(today, day) })),
		working: {
			minutes: hoursToMinutes(workingDays.length * (window.end - window.start)),
			busyMinutes: workingDays.reduce((sum, day) => sum + eventsOn(today, day).reduce((inside, event) => inside + hoursToMinutes(overlap(event)), 0), 0),
			focusMinutes: workingDays.reduce((sum, day) => sum + gaps(today, day, window, FOCUS_HOURS).reduce((inside, gap) => inside + hoursToMinutes(gap.end - gap.start), 0), 0),
		},
	};
};
