'use client';

import { DEFAULT_SETTINGS, isWeekend } from '@tempi/core';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useCalendarNavigation } from './calendar-navigation-provider';
import { TimeGrid } from './time-grid/time-grid';

/** The calendar body for the current view. The month grid comes later. */
export function CalendarMain() {
	const { days, timeZone, today, view } = useCalendarNavigation();
	const { data: settings } = useSettings();

	// Today is unknown while prerendering.
	if (days === null || today === null || view === 'month') return null;

	const showWeekends = settings?.showWeekends ?? DEFAULT_SETTINGS.showWeekends;
	// The day view always shows the picked day, weekend or not.
	const shownDays = view === 'week' && !showWeekends ? days.filter(day => !isWeekend(day)) : days;
	return <TimeGrid days={shownDays} timeZone={timeZone} today={today} />;
}
