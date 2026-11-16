import type { WeekStart } from '@tempi/core';
import { addDays, addMonths, addWeeks, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

export const CALENDAR_VIEWS = ['day', 'week', 'month'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const isCalendarView = (value: unknown): value is CalendarView => CALENDAR_VIEWS.some(view => view === value);

/** Local days shown by a view; `end` is exclusive (the start of the first day after the range). */
export type VisibleRange = { end: Date; start: Date };

const WEEK_STARTS_ON = { monday: 1, saturday: 6, sunday: 0 } as const satisfies Record<WeekStart, 0 | 1 | 2 | 3 | 4 | 5 | 6>;

/** The day, week (from the user's first weekday) or month that contains `date`. */
export const visibleRange = (date: Date, view: CalendarView, weekStart: WeekStart): VisibleRange => {
	switch (view) {
		case 'day': {
			const start = startOfDay(date);
			return { end: addDays(start, 1), start };
		}
		case 'week': {
			const start = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON[weekStart] });
			return { end: addDays(start, 7), start };
		}
		case 'month': {
			const start = startOfMonth(date);
			return { end: addMonths(start, 1), start };
		}
	}
};

/** Moves `date` one view-sized step back (-1) or forward (1). */
export const shiftDate = (date: Date, view: CalendarView, step: -1 | 1): Date => {
	switch (view) {
		case 'day':
			return addDays(date, step);
		case 'week':
			return addWeeks(date, step);
		case 'month':
			return addMonths(date, step);
	}
};
