'use client';

import { DEFAULT_SETTINGS, resolveLanguage } from '@tempi/core';
import { addDays } from 'date-fns';
import { useState } from 'react';
import { enUS, es } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { WEEK_STARTS_ON } from '@/lib/calendar-navigation';
import { useToday } from '../hooks/use-today';
import { useCalendarNavigation } from './calendar-navigation-provider';

const LOCALES = { en: enUS, es } as const;

/** Month picker in the sidebar: shows the visible range, and picking a day moves the main view there. */
export function MiniCalendar() {
	const { i18n, t } = useTranslation();
	const { date, goToDate, range } = useCalendarNavigation();
	const { data: settings } = useSettings();
	const today = useToday();
	// The month browsed with the arrows, remembered only while the main view stays on the same date.
	const [browsed, setBrowsed] = useState<{ anchor: number; month: Date } | null>(null);

	// Today is unknown while prerendering.
	if (date === null || range === null || today === null) return null;

	const weekStart = settings?.weekStart ?? DEFAULT_SETTINGS.weekStart;
	// Navigating the main view (header, a picked day) brings the mini calendar back to that date's month.
	const month = browsed?.anchor === date.getTime() ? browsed.month : date;

	return (
		<Calendar
			aria-label={t('shell.sidebar.datePicker')}
			className='mx-auto bg-transparent p-0 [--cell-size:--spacing(7)]'
			firstWeekContainsDate={1}
			// ISO 8601 numbers weeks from Monday; other week starts use local week numbering.
			ISOWeek={weekStart === 'monday'}
			locale={LOCALES[resolveLanguage([i18n.language])]}
			mode='single'
			modifiers={{ visibleRange: { from: range.start, to: addDays(range.end, -1) } }}
			modifiersClassNames={{ visibleRange: 'bg-accent text-accent-foreground' }}
			month={month}
			onMonthChange={shown => setBrowsed({ anchor: date.getTime(), month: shown })}
			onSelect={day => goToDate(day)}
			// Keeps a day selected: picking the selected day again doesn't clear it.
			required
			selected={date}
			showWeekNumber={settings?.showWeekNumbers ?? DEFAULT_SETTINGS.showWeekNumbers}
			today={new Date(today)}
			weekStartsOn={WEEK_STARTS_ON[weekStart]}
		/>
	);
}
