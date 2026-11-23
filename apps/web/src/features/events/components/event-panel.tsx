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
		const { changes, event } = selection;
		// Remount on another event, a saved change or new suggested changes, so the form starts from the right values.
		return (
			<EventForm
				calendars={calendars}
				changes={changes}
				defaultValues={eventToFormValues(event)}
				event={event}
				key={`${event.key}:${event.updatedAt}:${changes === undefined ? '' : JSON.stringify(changes)}`}
			/>
		);
	}

	const { draft } = selection;
	// A new event can only go where events may be created: never a read-only (synced) calendar.
	const writable = calendars.filter(calendar => !calendar.readOnly);
	const defaultCalendar = writable.find(calendar => calendar.isDefault && calendar.isVisible) ?? writable.find(calendar => calendar.isDefault) ?? writable[0];
	const defaultValues: EventFormValues = {
		...recurrenceFormValues(null, draft.startAt, timeZone),
		allDay: draft.allDay,
		calendarId: defaultCalendar?.id ?? '',
		description: '',
		endAt: toFormTime(draft.endAt, timeZone, draft.allDay, true),
		googleMeet: false,
		guests: [],
		location: '',
		reminderMinutes: null,
		startAt: toFormTime(draft.startAt, timeZone, draft.allDay),
		status: 'confirmed',
		timeZone,
		title: '',
		videoUrl: '',
		...draft.values,
	};
	return <EventForm calendars={calendars} defaultValues={defaultValues} event={null} key={`new:${draft.startAt}:${draft.endAt}:${draft.values === undefined ? '' : JSON.stringify(draft.values)}`} />;
}
