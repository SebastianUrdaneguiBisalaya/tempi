import type { DateRange } from './date-range';
import type { WeekStart } from './settings';

// Calendar days are `Temporal.PlainDate`s: a day on the calendar, not an instant. They become instants only
// with a time zone (the user's), so the same days work for any zone the profile is set to.

export const CALENDAR_VIEWS = ['day', 'week', 'month'] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const isCalendarView = (value: unknown): value is CalendarView => CALENDAR_VIEWS.some(view => view === value);

/** ISO 8601 weekday (Monday = 1 … Sunday = 7) each week start setting names. */
const FIRST_WEEKDAY = { monday: 1, saturday: 6, sunday: 7 } as const satisfies Record<WeekStart, number>;

export const startOfWeek = (date: Temporal.PlainDate, weekStart: WeekStart): Temporal.PlainDate => date.subtract({ days: (date.dayOfWeek - FIRST_WEEKDAY[weekStart] + 7) % 7 });

const daysFrom = (start: Temporal.PlainDate, count: number): Temporal.PlainDate[] => Array.from({ length: count }, (_, index) => start.add({ days: index }));

/** The days a view shows around `date`: that day, its week (from the user's first weekday) or its month. */
export const visibleDays = (date: Temporal.PlainDate, view: CalendarView, weekStart: WeekStart): Temporal.PlainDate[] => {
	switch (view) {
		case 'day':
			return [date];
		case 'week':
			return daysFrom(startOfWeek(date, weekStart), 7);
		case 'month':
			return daysFrom(date.with({ day: 1 }), date.daysInMonth);
	}
};

/** Moves `date` one view-sized step back (-1) or forward (1). Months clamp the day (Jan 31 → Feb 28). */
export const shiftDate = (date: Temporal.PlainDate, view: CalendarView, step: -1 | 1): Temporal.PlainDate => {
	switch (view) {
		case 'day':
			return date.add({ days: step });
		case 'week':
			return date.add({ weeks: step });
		case 'month':
			return date.add({ months: step });
	}
};

export const isWeekend = (date: Temporal.PlainDate): boolean => date.dayOfWeek >= 6;

// Same `…T00:00:00.000Z` shape as stored instants, so range bounds and event times compare correctly as text.
const startOfDayUtc = (date: Temporal.PlainDate, timeZone: string): string => new Date(date.toZonedDateTime({ timeZone }).epochMilliseconds).toISOString();

/** UTC range from the start of `first` to the start of the day after `last`, both in `timeZone`. */
export const daysToUtcRange = (first: Temporal.PlainDate, last: Temporal.PlainDate, timeZone: string): DateRange => ({
	end: startOfDayUtc(last.add({ days: 1 }), timeZone),
	start: startOfDayUtc(first, timeZone),
});
