'use client';

import { daysToUtcRange, upcomingEvents } from '@tempi/core';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useEvents } from '@/features/calendar/hooks/use-events';
import { useMinute } from '@/features/calendar/hooks/use-minute';

/**
 * The events in progress or starting within the next 24 hours, re-picked every minute so the list moves on as events
 * end. Loads whole days (today and tomorrow cover the window), so the query only changes when the day does.
 */
export const useUpcomingEvents = () => {
	const { timeZone, today } = useCalendarNavigation();
	const now = useMinute();
	const { data: calendars } = useCalendars();
	const { data: events, isLoading } = useEvents(today === null ? null : daysToUtcRange(today, today.add({ days: 1 }), timeZone));
	const hidden = new Set(calendars?.filter(calendar => !calendar.isVisible).map(calendar => calendar.id));
	const upcoming = now === null || events === undefined ? [] : upcomingEvents(events, Temporal.Instant.fromEpochMilliseconds(now), hidden);
	return { events: upcoming, isLoading, now };
};
