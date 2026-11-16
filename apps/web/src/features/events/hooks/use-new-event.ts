'use client';

import { DEFAULT_SETTINGS } from '@tempi/core';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { nextDraft } from '@/lib/event-draft';
import { useEventPanel } from '../components/event-panel-provider';

/** Opens the form for a new event on the day the calendar shows, at the next free slot (the `C` shortcut and the command menu). */
export const useNewEvent = () => {
	const { date, timeZone } = useCalendarNavigation();
	const { newEvent } = useEventPanel();
	const { data: settings } = useSettings();
	const duration = settings?.defaultEventDuration ?? DEFAULT_SETTINGS.defaultEventDuration;
	return () => {
		if (date !== null) newEvent(nextDraft(date, timeZone, duration));
	};
};
