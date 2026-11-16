'use client';

import { DEFAULT_SETTINGS } from '@tempi/core';
import { createContext, type ReactNode, use, useState } from 'react';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { type CalendarView, shiftDate, type VisibleRange, visibleRange } from '@/lib/calendar-navigation';
import { useToday } from '../hooks/use-today';

type CalendarNavigation = {
	/** The day the view is anchored on, or null while prerendering (today isn't known yet). */
	date: Date | null;
	/** Anchors the current view on `day`, e.g. a day picked in the mini calendar. */
	goToDate: (day: Date) => void;
	goToNext: () => void;
	goToPrevious: () => void;
	goToToday: () => void;
	range: VisibleRange | null;
	setView: (view: CalendarView) => void;
	view: CalendarView;
};

const CalendarNavigationContext = createContext<CalendarNavigation | null>(null);

/** Holds the date and view every part of the calendar shows (header, sidebar, grid). */
export function CalendarNavigationProvider({ children }: { children: ReactNode }) {
	const today = useToday();
	const { data: settings } = useSettings();
	// Null follows today, so the calendar moves with the clock until the user navigates away.
	const [anchor, setAnchor] = useState<Date | null>(null);
	const [view, setView] = useState<CalendarView>('week');

	const date = anchor ?? (today === null ? null : new Date(today));
	const step = (direction: -1 | 1) => setAnchor(current => shiftDate(current ?? new Date(), view, direction));

	const value: CalendarNavigation = {
		date,
		goToDate: setAnchor,
		goToNext: () => step(1),
		goToPrevious: () => step(-1),
		goToToday: () => setAnchor(null),
		range: date === null ? null : visibleRange(date, view, settings?.weekStart ?? DEFAULT_SETTINGS.weekStart),
		setView,
		view,
	};

	return <CalendarNavigationContext value={value}>{children}</CalendarNavigationContext>;
}

export const useCalendarNavigation = (): CalendarNavigation => {
	const navigation = use(CalendarNavigationContext);
	if (navigation === null) throw new Error('useCalendarNavigation must be used inside CalendarNavigationProvider');
	return navigation;
};
