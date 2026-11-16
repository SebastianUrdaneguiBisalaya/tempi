'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { fromLocalDate, toLocalDate } from '@/lib/plain-date';
import { useDayPickerOptions } from '../hooks/use-day-picker-options';
import { useCalendarNavigation } from './calendar-navigation-provider';

/** Month picker in the sidebar: shows the visible range, and picking a day moves the main view there. */
export function MiniCalendar() {
	const { t } = useTranslation();
	const { date, days, goToDate, today } = useCalendarNavigation();
	const dayPickerOptions = useDayPickerOptions();
	// The month browsed with the arrows, remembered only while the main view stays on the same date.
	const [browsed, setBrowsed] = useState<{ anchor: string; month: Date } | null>(null);

	// Today is unknown while prerendering.
	if (date === null || days === null || today === null) return null;

	const anchor = date.toString();
	// Navigating the main view (header, a picked day) brings the mini calendar back to that date's month.
	const month = browsed?.anchor === anchor ? browsed.month : toLocalDate(date);

	return (
		<Calendar
			aria-label={t('shell.sidebar.datePicker')}
			// Fills the sidebar group so its edges line up with the calendar list below (the generated root is `w-fit`).
			className='w-full! bg-transparent p-0 [--cell-size:--spacing(7)]'
			{...dayPickerOptions}
			// Always six weeks, so the sidebar doesn't jump when a month spans fewer rows.
			fixedWeeks
			mode='single'
			modifiers={{ visibleRange: { from: toLocalDate(days[0] ?? date), to: toLocalDate(days.at(-1) ?? date) } }}
			modifiersClassNames={{ visibleRange: 'bg-accent text-accent-foreground' }}
			month={month}
			onMonthChange={shown => setBrowsed({ anchor, month: shown })}
			onSelect={day => goToDate(fromLocalDate(day))}
			// Keeps a day selected: picking the selected day again doesn't clear it.
			required
			selected={toLocalDate(date)}
			today={toLocalDate(today)}
		/>
	);
}
