'use client';

import { DEFAULT_SETTINGS, resolveLanguage, type WeekStart } from '@tempi/core';
import { enUS, es } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/features/settings/hooks/use-settings';

const LOCALES = { en: enUS, es } as const;

/** `WeekStart` as react-day-picker's weekday index (0 = Sunday). */
const WEEK_STARTS_ON = { monday: 1, saturday: 6, sunday: 0 } as const satisfies Record<WeekStart, 0 | 1 | 6>;

/** react-day-picker props that follow the user's language and settings, shared by every date picker. */
export const useDayPickerOptions = () => {
	const { i18n } = useTranslation();
	const { data: settings } = useSettings();
	const weekStart = settings?.weekStart ?? DEFAULT_SETTINGS.weekStart;
	return {
		firstWeekContainsDate: 1,
		// ISO 8601 numbers weeks from Monday; other week starts use local week numbering.
		ISOWeek: weekStart === 'monday',
		locale: LOCALES[resolveLanguage([i18n.language])],
		showWeekNumber: settings?.showWeekNumbers ?? DEFAULT_SETTINGS.showWeekNumbers,
		weekStartsOn: WEEK_STARTS_ON[weekStart],
	} as const;
};
