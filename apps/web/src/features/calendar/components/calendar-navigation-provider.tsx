'use client';

import { DEFAULT_SETTINGS } from '@tempi/core';
import { type CalendarState, useCalendar } from '@usecalendar/react';
import { createContext, type ReactNode, use } from 'react';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { useSettings } from '@/features/settings/hooks/use-settings';

const CalendarNavigationContext = createContext<CalendarState | null>(null);

/**
 * Holds the date and view every part of the app shows (header, sidebar, grid, command menu, tray), as days in the
 * user's time zone. The state is `@usecalendar`'s, so the grid reads the same one; with no date picked it follows
 * today, moving with the clock until the user navigates away.
 */
export function CalendarNavigationProvider({ children }: { children: ReactNode }) {
	const timeZone = useTimeZone();
	const { data: settings } = useSettings();
	const { showWeekends, showWeekNumbers, weekStart } = settings ?? DEFAULT_SETTINGS;
	const calendar = useCalendar({ defaultView: 'week', showWeekends, showWeekNumbers, timeZone, weekStart });

	return <CalendarNavigationContext value={calendar}>{children}</CalendarNavigationContext>;
}

export const useCalendarNavigation = (): CalendarState => {
	const navigation = use(CalendarNavigationContext);
	if (navigation === null) throw new Error('useCalendarNavigation must be used inside CalendarNavigationProvider');
	return navigation;
};
