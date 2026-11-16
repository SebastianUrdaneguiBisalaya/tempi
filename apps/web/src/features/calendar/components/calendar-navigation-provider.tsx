'use client';

import { type CalendarView, DEFAULT_SETTINGS, shiftDate, visibleDays } from '@tempi/core';
import { createContext, type ReactNode, use, useState } from 'react';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useToday } from '../hooks/use-today';

type CalendarNavigation = {
	/** The day the view is anchored on, or null while prerendering (today isn't known yet). */
	date: Temporal.PlainDate | null;
	/** Every day the current view covers, in order; null while prerendering. */
	days: Temporal.PlainDate[] | null;
	/** Anchors the current view on `day`, e.g. a day picked in the mini calendar. */
	goToDate: (day: Temporal.PlainDate) => void;
	goToNext: () => void;
	goToPrevious: () => void;
	goToToday: () => void;
	setView: (view: CalendarView) => void;
	/** IANA zone every day and time is shown in. */
	timeZone: string;
	today: Temporal.PlainDate | null;
	view: CalendarView;
};

const CalendarNavigationContext = createContext<CalendarNavigation | null>(null);

/** Holds the date and view every part of the calendar shows (header, sidebar, grid), as days in the user's time zone. */
export function CalendarNavigationProvider({ children }: { children: ReactNode }) {
	const timeZone = useTimeZone();
	const todayText = useToday(timeZone);
	const { data: settings } = useSettings();
	// Null follows today, so the calendar moves with the clock until the user navigates away.
	const [anchor, setAnchor] = useState<Temporal.PlainDate | null>(null);
	const [view, setView] = useState<CalendarView>('week');

	const today = todayText === null ? null : Temporal.PlainDate.from(todayText);
	const date = anchor ?? today;
	const step = (direction: -1 | 1) => setAnchor(current => shiftDate(current ?? Temporal.Now.plainDateISO(timeZone), view, direction));

	const value: CalendarNavigation = {
		date,
		days: date === null ? null : visibleDays(date, view, settings?.weekStart ?? DEFAULT_SETTINGS.weekStart),
		goToDate: setAnchor,
		goToNext: () => step(1),
		goToPrevious: () => step(-1),
		goToToday: () => setAnchor(null),
		setView,
		timeZone,
		today,
		view,
	};

	return <CalendarNavigationContext value={value}>{children}</CalendarNavigationContext>;
}

export const useCalendarNavigation = (): CalendarNavigation => {
	const navigation = use(CalendarNavigationContext);
	if (navigation === null) throw new Error('useCalendarNavigation must be used inside CalendarNavigationProvider');
	return navigation;
};
