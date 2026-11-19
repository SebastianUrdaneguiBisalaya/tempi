'use client';

import { DEFAULT_SETTINGS, resolveLanguage } from '@tempi/core';
import type { CalendarLocaleOptions } from '@usecalendar/react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/features/settings/hooks/use-settings';

/** The calendar's locale, clock format and every text it renders, in the user's language. */
export const useCalendarLocale = (): CalendarLocaleOptions => {
	const { i18n, t } = useTranslation();
	const { data: settings } = useSettings();

	return {
		labels: {
			allDayEvents: titles => t('calendar.allDay.events', { titles: titles.join(', ') }),
			collapseAllDay: t('calendar.allDay.collapse'),
			// The grid keys are never remapped, so the translated sentence always matches the bound keys.
			eventKeyboardHint: () => t('calendar.event.keyboard'),
			expandAllDay: t('calendar.allDay.expand'),
			grid: t('calendar.grid'),
			moreEvents: count => t('calendar.month.more', { count }),
			navigation: t('shell.header.label'),
			tentative: t('events.status.tentative'),
			today: t('shell.header.today'),
			viewSwitcher: t('shell.views.label'),
			views: { day: t('shell.views.day'), month: t('shell.views.month'), week: t('shell.views.week') },
			weekNumber: number => t('calendar.month.week', { number }),
			weekNumberHeader: t('calendar.month.weekNumber'),
		},
		locale: resolveLanguage([i18n.language]),
		timeFormat: settings?.timeFormat ?? DEFAULT_SETTINGS.timeFormat,
	};
};
