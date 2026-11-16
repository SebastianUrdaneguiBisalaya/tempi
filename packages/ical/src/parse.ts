import { fail, type ImportedEvent, isValidTimeZone, MAX_REMINDER_MINUTES, ok, type Result } from '@tempi/core';
import ICAL from 'ical.js';

/** How to read what a file leaves open. */
export type ParseOptions = {
	/** Minutes a timed event lasts when the file gives no end. */
	defaultDurationMinutes: number;
	/** The user's IANA zone, for all-day and floating times and for zones that aren't IANA names. */
	timeZone: string;
};

/** The events of a file, and how many of its VEVENTs could not be read at all. */
export type ParsedIcs = { events: ImportedEvent[]; skipped: number };

/** Non-standard property Tempi writes on all-day events, which iCalendar dates can't tie to a zone. */
export const TEMPI_TIME_ZONE = 'x-tempi-time-zone';

const VIDEO_URL = /^https?:\/\/\S+$/i;

type When = { allDay: boolean; instant: Temporal.Instant; timeZone: string };

const wallClock = (time: ICAL.Time, timeZone: string): Temporal.Instant =>
	Temporal.PlainDateTime.from({ day: time.day, hour: time.hour, minute: time.minute, month: time.month, second: time.second, year: time.year })
		.toZonedDateTime(timeZone, { disambiguation: 'compatible' })
		.toInstant();

/**
 * When a DTSTART-like value happens. UTC stays UTC; an IANA TZID is honored as is; any other TZID (e.g. Outlook's
 * "Pacific Standard Time") is resolved through the file's VTIMEZONE when it has one; dates and floating times are in
 * the user's zone (or the zone Tempi wrote for an all-day event).
 */
const whenOf = (property: ICAL.Property, time: ICAL.Time, fallbackZone: string): When => {
	if (time.isDate) return { allDay: true, instant: wallClock(time, fallbackZone), timeZone: fallbackZone };
	if (time.zone === ICAL.Timezone.utcTimezone) return { allDay: false, instant: Temporal.Instant.fromEpochMilliseconds(time.toUnixTime() * 1000), timeZone: 'UTC' };
	const tzid = property.getFirstParameter('tzid');
	if (typeof tzid === 'string' && isValidTimeZone(tzid)) return { allDay: false, instant: wallClock(time, tzid), timeZone: tzid };
	if (typeof tzid === 'string' && ICAL.TimezoneService.has(tzid)) {
		return { allDay: false, instant: Temporal.Instant.fromEpochMilliseconds(time.toUnixTime() * 1000), timeZone: fallbackZone };
	}
	return { allDay: false, instant: wallClock(time, fallbackZone), timeZone: fallbackZone };
};

const timeOf = (property: ICAL.Property | null): ICAL.Time | null => {
	const value = property?.getFirstValue();
	return value instanceof ICAL.Time ? value : null;
};

const textOf = (vevent: ICAL.Component, name: string): string | null => {
	const value = vevent.getFirstPropertyValue(name);
	return typeof value === 'string' && value.trim() !== '' ? value : null;
};

/** The first alarm that fires at or before the start, as minutes before it; Tempi keeps one reminder. */
const reminderOf = (vevent: ICAL.Component): number | null => {
	for (const alarm of vevent.getAllSubcomponents('valarm')) {
		const trigger = alarm.getFirstProperty('trigger');
		const value = trigger?.getFirstValue();
		if (!(value instanceof ICAL.Duration) || trigger?.getFirstParameter('related') === 'END') continue;
		const minutes = Math.round(-value.toSeconds() / 60);
		if (minutes >= 0 && minutes <= MAX_REMINDER_MINUTES) return minutes;
	}
	return null;
};

const instants = (vevent: ICAL.Component, name: string, zone: string): string[] =>
	vevent.getAllProperties(name).flatMap(property =>
		property
			.getValues()
			.filter((value): value is ICAL.Time => value instanceof ICAL.Time)
			.map(time => whenOf(property, time, zone).instant.toString())
	);

type ReadEvent = { cancelled: boolean; event: ImportedEvent; recurrenceId: string | null };

/** One VEVENT as Tempi fields. Optional fields Tempi can't use (a non-web link, a far alarm) are dropped, not fatal. */
const readEvent = (vevent: ICAL.Component, options: ParseOptions): ReadEvent | null => {
	const startProperty = vevent.getFirstProperty('dtstart');
	const startTime = timeOf(startProperty);
	if (startProperty === null || startTime === null) return null;

	const tempiZone = textOf(vevent, TEMPI_TIME_ZONE);
	const zone = tempiZone !== null && isValidTimeZone(tempiZone) ? tempiZone : options.timeZone;
	const start = whenOf(startProperty, startTime, zone);

	const endProperty = vevent.getFirstProperty('dtend');
	const endTime = timeOf(endProperty);
	const duration = vevent.getFirstPropertyValue('duration');
	let end: Temporal.Instant;
	if (endProperty !== null && endTime !== null) end = whenOf(endProperty, endTime, zone).instant;
	else if (duration instanceof ICAL.Duration) end = start.instant.add({ seconds: duration.toSeconds() });
	// Without an end, an all-day event lasts its day; a timed one the user's default duration.
	else if (start.allDay) end = start.instant.toZonedDateTimeISO(start.timeZone).add({ days: 1 }).toInstant();
	else end = start.instant.add({ minutes: options.defaultDurationMinutes });

	const rrule = vevent.getFirstProperty('rrule');
	const conference = textOf(vevent, 'conference') ?? textOf(vevent, 'x-google-conference') ?? textOf(vevent, 'url');
	const status = textOf(vevent, 'status')?.toUpperCase();
	const recurrence = vevent.getFirstProperty('recurrence-id');
	const recurrenceTime = timeOf(recurrence);

	return {
		cancelled: status === 'CANCELLED',
		event: {
			exDates: instants(vevent, 'exdate', zone),
			fields: {
				allDay: start.allDay,
				description: textOf(vevent, 'description'),
				endAt: end.toString(),
				location: textOf(vevent, 'location'),
				reminderMinutes: reminderOf(vevent),
				// Core strips the `RRULE:` prefix and validates the rule.
				rrule: rrule === null ? null : rrule.toICALString(),
				startAt: start.instant.toString(),
				status: status === 'TENTATIVE' ? 'tentative' : 'confirmed',
				timeZone: start.timeZone,
				title: textOf(vevent, 'summary') ?? '',
				videoUrl: conference !== null && VIDEO_URL.test(conference) ? conference : null,
			},
			overrides: [],
			uid: textOf(vevent, 'uid'),
		},
		recurrenceId: recurrence === null || recurrenceTime === null ? null : whenOf(recurrence, recurrenceTime, zone).instant.toString(),
	};
};

/**
 * Reads the events of an `.ics` file: each series with its exceptions (EXDATE, and VEVENTs sharing its UID with a
 * RECURRENCE-ID). A cancelled event is left out, a cancelled occurrence becomes a skipped date. Fails only when the
 * text isn't iCalendar at all; VEVENTs that can't be read are counted in `skipped`.
 */
export const parseIcs = (text: string, options: ParseOptions): Result<ParsedIcs> => {
	let root: ICAL.Component;
	try {
		root = new ICAL.Component(ICAL.parse(text));
	} catch (error) {
		return fail('validation', 'ical.invalidFile', { detail: `Not an iCalendar file: ${error instanceof Error ? error.message : String(error)}` });
	}
	if (root.name !== 'vcalendar') return fail('validation', 'ical.invalidFile', { detail: `Expected a VCALENDAR, found ${root.name.toUpperCase()}` });

	// Zones the file defines (e.g. Outlook's Windows names) must be known before reading any time that uses them.
	const registered = root.getAllSubcomponents('vtimezone').flatMap(vtimezone => {
		const tzid = vtimezone.getFirstPropertyValue('tzid');
		if (typeof tzid !== 'string' || isValidTimeZone(tzid) || ICAL.TimezoneService.has(tzid)) return [];
		ICAL.TimezoneService.register(new ICAL.Timezone({ component: vtimezone, tzid }));
		return [tzid];
	});

	try {
		let skipped = 0;
		const read = root.getAllSubcomponents('vevent').flatMap(vevent => {
			try {
				const event = readEvent(vevent, options);
				if (event === null) skipped += 1;
				return event === null ? [] : [event];
			} catch {
				skipped += 1;
				return [];
			}
		});

		const masters = read.filter(item => item.recurrenceId === null && !item.cancelled).map(item => item.event);
		const byUid = new Map(masters.flatMap(event => (event.uid === null ? [] : [[event.uid, event] as const])));
		const standalone: ImportedEvent[] = [];
		for (const { cancelled, event, recurrenceId } of read) {
			if (recurrenceId === null) continue;
			const series = event.uid === null ? undefined : byUid.get(event.uid);
			if (series !== undefined) {
				if (cancelled) series.exDates.push(recurrenceId);
				else series.overrides.push({ fields: { ...event.fields, rrule: null }, originalStartAt: recurrenceId });
			} else if (!cancelled) {
				// An occurrence without its series in the file (e.g. a single invitation) imports as an event of its own.
				standalone.push({ ...event, fields: { ...event.fields, rrule: null }, uid: event.uid === null ? null : `${event.uid}/${recurrenceId}` });
			}
		}
		return ok({ events: [...masters, ...standalone], skipped });
	} finally {
		for (const tzid of registered) ICAL.TimezoneService.remove(tzid);
	}
};
