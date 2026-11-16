'use client';

import type { EventOccurrence } from '@tempi/core';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useEventPanel } from '../components/event-panel-provider';

/** Moves the calendar to an event's day and opens its detail, e.g. from a search result. */
export const useShowEvent = () => {
	const { goToDate, timeZone } = useCalendarNavigation();
	const { openEvent } = useEventPanel();
	return (event: EventOccurrence) => {
		// An all-day event's day is fixed in its own zone; a timed one falls on its day in the zone the calendar shows.
		goToDate(
			Temporal.Instant.from(event.startAt)
				.toZonedDateTimeISO(event.allDay ? event.timeZone : timeZone)
				.toPlainDate()
		);
		openEvent(event);
	};
};
