'use client';

import type { CalendarView } from '@usecalendar/core';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { useCalendarNavigation } from './calendar-navigation-provider';

/** Calendar navigation shortcuts: today, next and previous period, and the view. */
export function CalendarShortcuts() {
	const { goToNext, goToPrevious, goToToday, setView } = useCalendarNavigation();
	const showView = (view: CalendarView) => () => setView(view);

	useShortcut('goToToday', goToToday);
	useShortcut('next', goToNext);
	useShortcut('previous', goToPrevious);
	useShortcut('dayView', showView('day'));
	useShortcut('weekView', showView('week'));
	useShortcut('monthView', showView('month'));

	return null;
}
