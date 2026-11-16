'use client';

import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { type EventFormValues, eventToFormValues, recurrenceFormValues, toFormTime } from '@/lib/event-form-values';
import { EventForm } from './event-form';
import { useEventPanel } from './event-panel-provider';

/** The right panel's event area: the selected event's editable detail, or the form for a new one. */
export function EventPanel() {
	const { selection } = useEventPanel();
	const { data: calendars } = useCalendars();
	const timeZone = useTimeZone();

	// Without calendars (still loading, or no storage) there is nothing to put an event in.
	if (selection === null || calendars === undefined) return null;

	if (selection.kind === 'event') {
		const { event } = selection;
		// Remount on another event or a saved change, so the form starts from the stored values.
		return <EventForm calendars={calendars} defaultValues={eventToFormValues(event)} event={event} key={`${event.key}:${event.updatedAt}`} />;
	}

	const { draft } = selection;
	const defaultCalendar = calendars.find(calendar => calendar.isDefault && calendar.isVisible) ?? calendars.find(calendar => calendar.isDefault) ?? calendars[0];
	const defaultValues: EventFormValues = {
		...recurrenceFormValues(null, draft.startAt, timeZone),
		allDay: draft.allDay,
		calendarId: defaultCalendar?.id ?? '',
		description: '',
		endAt: toFormTime(draft.endAt, timeZone, draft.allDay, true),
		location: '',
		reminderMinutes: null,
		startAt: toFormTime(draft.startAt, timeZone, draft.allDay),
		timeZone,
		title: '',
	};
	return <EventForm calendars={calendars} defaultValues={defaultValues} event={null} key={`new:${draft.startAt}:${draft.endAt}`} />;
}
