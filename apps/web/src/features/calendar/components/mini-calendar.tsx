'use client';

import { DEFAULT_SETTINGS, resolveLanguage, type WeekStart } from '@tempi/core';
import { useState } from 'react';
import { enUS, es } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { fromLocalDate, toLocalDate } from '@/lib/plain-date';
import { useCalendarNavigation } from './calendar-navigation-provider';

const LOCALES = { en: enUS, es } as const;

/** `WeekStart` as react-day-picker's weekday index (0 = Sunday). */
const WEEK_STARTS_ON = { monday: 1, saturday: 6, sunday: 0 } as const satisfies Record<WeekStart, 0 | 1 | 6>;

/** Month picker in the sidebar: shows the visible range, and picking a day moves the main view there. */
export function MiniCalendar() {
	const { i18n, t } = useTranslation();
	const { date, days, goToDate, today } = useCalendarNavigation();
	const { data: settings } = useSettings();
	// The month browsed with the arrows, remembered only while the main view stays on the same date.
	const [browsed, setBrowsed] = useState<{ anchor: string; month: Date } | null>(null);

	// Today is unknown while prerendering.
	if (date === null || days === null || today === null) return null;

	const weekStart = settings?.weekStart ?? DEFAULT_SETTINGS.weekStart;
	const anchor = date.toString();
	// Navigating the main view (header, a picked day) brings the mini calendar back to that date's month.
	const month = browsed?.anchor === anchor ? browsed.month : toLocalDate(date);

	return (
		<Calendar
			aria-label={t('shell.sidebar.datePicker')}
			className='mx-auto bg-transparent p-0 [--cell-size:--spacing(7)]'
			firstWeekContainsDate={1}
			// ISO 8601 numbers weeks from Monday; other week starts use local week numbering.
			ISOWeek={weekStart === 'monday'}
			locale={LOCALES[resolveLanguage([i18n.language])]}
			mode='single'
			modifiers={{ visibleRange: { from: toLocalDate(days[0] ?? date), to: toLocalDate(days.at(-1) ?? date) } }}
			modifiersClassNames={{ visibleRange: 'bg-accent text-accent-foreground' }}
			month={month}
			onMonthChange={shown => setBrowsed({ anchor, month: shown })}
			onSelect={day => goToDate(fromLocalDate(day))}
			// Keeps a day selected: picking the selected day again doesn't clear it.
			required
			selected={toLocalDate(date)}
			showWeekNumber={settings?.showWeekNumbers ?? DEFAULT_SETTINGS.showWeekNumbers}
			today={toLocalDate(today)}
			weekStartsOn={WEEK_STARTS_ON[weekStart]}
		/>
	);
}
