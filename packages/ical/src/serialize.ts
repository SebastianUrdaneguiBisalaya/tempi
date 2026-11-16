import type { CalendarEvent, ExportedCalendars } from '@tempi/core';
import ICAL from 'ical.js';
import { TEMPI_TIME_ZONE } from './parse';

const PRODID = '-//Tempi//Tempi Calendar//EN';

/** The UID an event is exported under: the one it was imported with, or its id. */
const uidOf = (event: CalendarEvent): string => event.icalUid ?? event.id;

/**
 * A time property in the event's own zone, so recurrences keep their wall-clock time across DST: `TZID` with the IANA
 * name (UTC as `Z`), or a plain date for all-day events. Tempi writes no VTIMEZONE; IANA names identify the zone.
 */
const timeProperty = (name: string, instant: string, { allDay, timeZone }: Pick<CalendarEvent, 'allDay' | 'timeZone'>): ICAL.Property => {
	const local = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
	const property = new ICAL.Property(name);
	if (allDay) {
		property.resetType('date');
		property.setValue(ICAL.Time.fromData({ day: local.day, isDate: true, month: local.month, year: local.year }));
		return property;
	}
	const fields = { day: local.day, hour: local.hour, minute: local.minute, month: local.month, second: local.second, year: local.year };
	if (timeZone === 'UTC') {
		property.setValue(ICAL.Time.fromData(fields, ICAL.Timezone.utcTimezone));
		return property;
	}
	property.setValue(ICAL.Time.fromData(fields));
	property.setParameter('tzid', timeZone);
	return property;
};

const utcProperty = (name: string, instant: string): ICAL.Property => {
	const property = new ICAL.Property(name);
	property.setValue(ICAL.Time.fromJSDate(new Date(instant), true));
	return property;
};

const toVevent = (event: CalendarEvent, series: CalendarEvent | undefined, editedStarts: ReadonlySet<string>, stamp: string): ICAL.Component => {
	const vevent = new ICAL.Component('vevent');
	vevent.addPropertyWithValue('uid', uidOf(series ?? event));
	vevent.addProperty(utcProperty('dtstamp', stamp));
	vevent.addProperty(utcProperty('created', event.createdAt));
	vevent.addProperty(utcProperty('last-modified', event.updatedAt));
	vevent.addProperty(timeProperty('dtstart', event.startAt, event));
	vevent.addProperty(timeProperty('dtend', event.endAt, event));
	if (event.allDay) vevent.addPropertyWithValue(TEMPI_TIME_ZONE, event.timeZone);
	// An edited occurrence names the series start it replaces, in the series' own format.
	if (series !== undefined && event.originalStartAt !== null) vevent.addProperty(timeProperty('recurrence-id', event.originalStartAt, series));
	if (event.rrule !== null) vevent.addPropertyWithValue('rrule', ICAL.Recur.fromString(event.rrule));
	// Edited occurrences are their own VEVENTs; listing them as EXDATE too would hide them in other apps.
	for (const date of event.exDates.filter(date => !editedStarts.has(date))) vevent.addProperty(timeProperty('exdate', date, event));
	vevent.addPropertyWithValue('summary', event.title);
	if (event.description !== null) vevent.addPropertyWithValue('description', event.description);
	if (event.location !== null) vevent.addPropertyWithValue('location', event.location);
	if (event.videoUrl !== null) {
		const conference = new ICAL.Property('conference');
		conference.resetType('uri');
		conference.setValue(event.videoUrl);
		vevent.addProperty(conference);
	}
	vevent.addPropertyWithValue('status', event.status === 'tentative' ? 'TENTATIVE' : 'CONFIRMED');
	if (event.reminderMinutes !== null) {
		const alarm = new ICAL.Component('valarm');
		alarm.addPropertyWithValue('action', 'DISPLAY');
		alarm.addPropertyWithValue('description', event.title);
		alarm.addPropertyWithValue('trigger', ICAL.Duration.fromSeconds(-event.reminderMinutes * 60));
		vevent.addSubcomponent(alarm);
	}
	return vevent;
};

/**
 * Writes calendars and their events as one `.ics` file: each event, series (with RRULE and EXDATE) and edited
 * occurrence (RECURRENCE-ID) as a VEVENT, with the fields `parseIcs` reads back, so importing it recreates the same events.
 */
export const serializeIcs = ({ calendars, events }: ExportedCalendars, now: Date): string => {
	const root = new ICAL.Component('vcalendar');
	root.addPropertyWithValue('version', '2.0');
	root.addPropertyWithValue('prodid', PRODID);
	root.addPropertyWithValue('calscale', 'GREGORIAN');
	const [only] = calendars;
	if (calendars.length === 1 && only !== undefined) root.addPropertyWithValue('x-wr-calname', only.name);

	const byId = new Map(events.map(event => [event.id, event]));
	const editedStarts = new Map<string, Set<string>>();
	for (const event of events) {
		if (event.recurringEventId === null || event.originalStartAt === null) continue;
		const starts = editedStarts.get(event.recurringEventId) ?? new Set<string>();
		starts.add(event.originalStartAt);
		editedStarts.set(event.recurringEventId, starts);
	}

	const stamp = now.toISOString();
	for (const event of events) {
		const series = event.recurringEventId === null ? undefined : byId.get(event.recurringEventId);
		// An edited occurrence whose series isn't exported has nothing to attach to.
		if (event.recurringEventId !== null && series === undefined) continue;
		root.addSubcomponent(toVevent(event, series, editedStarts.get(event.id) ?? new Set(), stamp));
	}
	return root.toString();
};
