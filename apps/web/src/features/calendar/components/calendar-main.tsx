'use client';

import { DEFAULT_SETTINGS, type EventOccurrence, isSameRange, resolveLanguage } from '@tempi/core';
import type { CalendarEvent, TimeRange } from '@usecalendar/core';
import { Calendar } from '@usecalendar/react';
import { useTranslation } from 'react-i18next';
import { EventContextMenu } from '@/features/events/components/event-context-menu';
import { useEventPanel } from '@/features/events/components/event-panel-provider';
import { EventPreview } from '@/features/events/components/event-preview';
import { useRescheduleEvent } from '@/features/events/hooks/use-event-mutations';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { useSetAllDayCollapsed, useSettings } from '@/features/settings/hooks/use-settings';
import { useGridShortcutScope } from '@/features/shortcuts/hooks/use-shortcut';
import { CALENDAR_HOTKEYS } from '@/features/shortcuts/shortcuts';
import { timeZoneHeader } from '@/lib/countries';
import { useCalendarLocale } from '../hooks/use-calendar-locale';
import { useCalendars } from '../hooks/use-calendars';
import { useEvents } from '../hooks/use-events';
import { useCalendarNavigation } from './calendar-navigation-provider';
import { MonthMorePopover } from './month-more-popover';
import { TimeZonePreview } from './time-zone-preview';

/**
 * The calendar body: `@usecalendar`'s month, week and day views over the shared navigation state. It only draws and
 * reports intents; opening, creating and rescheduling events stay in the event panel and mutations.
 */
export function CalendarMain() {
	const calendar = useCalendarNavigation();
	const { data: settings } = useSettings();
	const { allDayCollapsed, defaultEventDuration, secondaryTimeZones, workingHours } = settings ?? DEFAULT_SETTINGS;
	const timeZone = useTimeZone();
	const { chooseScope, newEvent, openEvent, refreshEvent, selection } = useEventPanel();
	const reschedule = useRescheduleEvent();
	const setAllDayCollapsed = useSetAllDayCollapsed();
	const { data: calendars } = useCalendars();
	const { data: occurrences } = useEvents(calendar.range);
	const locale = useCalendarLocale();
	const { i18n } = useTranslation();
	const language = resolveLanguage([i18n.language]);
	useGridShortcutScope();

	const calendarById = new Map((calendars ?? []).map(item => [item.id, item]));
	// Hidden calendars stay out; each occurrence is drawn in its calendar's color and handed back in every callback.
	const events: CalendarEvent<EventOccurrence>[] = (occurrences ?? [])
		.filter(event => calendarById.get(event.calendarId)?.isVisible !== false)
		.map(event => ({
			allDay: event.allDay,
			color: calendarById.get(event.calendarId)?.color,
			data: event,
			endAt: event.endAt,
			id: event.key,
			startAt: event.startAt,
			status: event.status,
			timeZone: event.timeZone,
			title: event.title,
		}));

	const createEvent = (range: TimeRange) => newEvent({ allDay: false, ...range });

	const changeEvent = async (event: EventOccurrence, range: TimeRange) => {
		// Compared as instants: the calendar writes `…00Z` and storage `…00.000Z`, so a drop back in place is no change.
		if (isSameRange(range, event)) return;
		// An occurrence of a recurring event asks how far the change reaches; cancelling leaves it where it was.
		const scope = event.series === null ? undefined : await chooseScope({ action: 'edit', allowThis: true, title: event.title });
		if (scope === null) return;
		reschedule.mutate({ occurrence: event, range, scope }, { onSuccess: saved => refreshEvent(event.key, saved) });
	};

	// The new event's form is open: preview its times on the grid.
	const draft = selection?.kind === 'new' && !selection.draft.allDay ? selection.draft : null;

	return (
		<Calendar<EventOccurrence>
			{...locale}
			allDayCollapsed={allDayCollapsed}
			calendar={calendar}
			className='h-full'
			defaultEventDuration={defaultEventDuration}
			draftRange={draft === null ? null : { endAt: draft.endAt, startAt: draft.startAt }}
			events={events}
			hotkeys={CALENDAR_HOTKEYS}
			isEventEditable={event => event.data !== undefined && calendarById.get(event.data.calendarId)?.readOnly !== true}
			onAllDayCollapsedChange={collapsed => setAllDayCollapsed.mutate(collapsed)}
			onEventChange={(event, range) => event.data !== undefined && void changeEvent(event.data, range)}
			onEventClick={event => event.data !== undefined && openEvent(event.data)}
			onRangeSelect={createEvent}
			onSlotClick={createEvent}
			renderMorePopover={MonthMorePopover}
			// A zone the profile later switched to already has the main column.
			secondaryTimeZones={secondaryTimeZones.filter(zone => zone !== timeZone).map(zone => ({ ...timeZoneHeader(zone, language), timeZone: zone }))}
			timeZoneLabel={timeZoneHeader(timeZone, language)}
			renderTimeZoneWrapper={props => <TimeZonePreview {...props} />}
			// The calendar's own `eventPopover` stays off: the app's popover previews an event on hover, and a click still opens the panel.
			renderEventWrapper={({ children, event }) =>
				event.data === undefined ? (
					children
				) : (
					<EventContextMenu event={event.data}>
						<EventPreview event={event}>{children}</EventPreview>
					</EventContextMenu>
				)
			}
			workingHours={workingHours.enabled ? { days: workingHours.days, end: Temporal.PlainTime.from(workingHours.end), start: Temporal.PlainTime.from(workingHours.start) } : undefined}
			selectedEventId={selection?.kind === 'event' ? selection.event.key : null}
			// The app header holds the navigation and view switcher, next to the sidebar, panel and settings buttons.
			toolbar={false}
		/>
	);
}
