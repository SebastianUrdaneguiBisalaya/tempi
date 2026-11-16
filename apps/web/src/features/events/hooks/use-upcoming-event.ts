'use client';

import { daysToUtcRange, UPCOMING_WINDOW_DAYS, upcomingEvent } from '@tempi/core';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useEvents } from '@/features/calendar/hooks/use-events';
import { useMinute } from '@/features/calendar/hooks/use-minute';

/**
 * The event in progress or starting next, re-picked every minute so the card moves on when an event ends.
 * Loads whole days (today through the window), so the query only changes when the day does, not every minute.
 */
export const useUpcomingEvent = () => {
	const { timeZone, today } = useCalendarNavigation();
	const now = useMinute();
	const { data: calendars } = useCalendars();
	const { data: events, isLoading } = useEvents(today === null ? null : daysToUtcRange(today, today.add({ days: UPCOMING_WINDOW_DAYS }), timeZone));
	const hidden = new Set(calendars?.filter(calendar => !calendar.isVisible).map(calendar => calendar.id));
	const event = now === null || events === undefined ? null : upcomingEvent(events, Temporal.Instant.fromEpochMilliseconds(now), hidden);
	return { event, isLoading, now };
};
