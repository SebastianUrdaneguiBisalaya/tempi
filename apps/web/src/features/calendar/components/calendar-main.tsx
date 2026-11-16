'use client';

import { DEFAULT_SETTINGS, isWeekend } from '@tempi/core';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useGridShortcutScope } from '@/features/shortcuts/hooks/use-shortcut';
import { useCalendarNavigation } from './calendar-navigation-provider';
import { MonthGrid } from './month-grid/month-grid';
import { TimeGrid } from './time-grid/time-grid';

/** The calendar body for the current view. */
export function CalendarMain() {
	const { date, days, timeZone, today, view } = useCalendarNavigation();
	const { data: settings } = useSettings();
	useGridShortcutScope();

	// Today is unknown while prerendering.
	if (date === null || days === null || today === null) return null;
	if (view === 'month') return <MonthGrid date={date} timeZone={timeZone} today={today} />;

	const showWeekends = settings?.showWeekends ?? DEFAULT_SETTINGS.showWeekends;
	// The day view always shows the picked day, weekend or not.
	const shownDays = view === 'week' && !showWeekends ? days.filter(day => !isWeekend(day)) : days;
	return <TimeGrid days={shownDays} timeZone={timeZone} today={today} />;
}
