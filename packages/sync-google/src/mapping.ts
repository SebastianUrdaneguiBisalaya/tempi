import { type CalendarEvent, type GoogleAttendee, type GoogleEventLink, isValidTimeZone, MAX_REMINDER_MINUTES, toUtcInstant } from '@tempi/core';
import type { GoogleEvent, GoogleEventInput, GoogleEventTime } from '@usemeshly/google-calendar';

/** Private property that keeps Tempi's video link, which Google has no plain field for. */
export const VIDEO_URL_PROPERTY = 'tempiVideoUrl';

/** Google events Tempi doesn't show: working locations and the like are statuses, not events. */
const SKIPPED_TYPES = new Set(['workingLocation', 'outOfOffice', 'focusTime', 'fromGmail']);

const VIDEO_URL = /^https?:\/\/\S+$/i;

/** The event fields Google carries, ready for core's event schema. */
export type PulledFields = Pick<
	CalendarEvent,
	'allDay' | 'description' | 'endAt' | 'googleMeet' | 'guests' | 'guestsReadOnly' | 'location' | 'reminderMinutes' | 'rrule' | 'startAt' | 'status' | 'timeZone' | 'title' | 'videoUrl'
> & {
	/** EXDATEs of a recurring event, as UTC instants. */
	exDates: string[];
};

const utc = (instant: Temporal.Instant): string => new Date(instant.epochMilliseconds).toISOString();

/** A Google start, end or original start as a UTC instant. Dates (all-day) are midnight in `zone`. */
export const instantOf = (time: GoogleEventTime, zone: string): { allDay: boolean; instant: string } | null => {
	if (time.dateTime !== undefined) {
		const instant = toUtcInstant(time.dateTime);
		return instant === null ? null : { allDay: false, instant };
	}
	if (time.date === undefined) return null;
	try {
		return { allDay: true, instant: utc(Temporal.PlainDate.from(time.date).toZonedDateTime(zone).toInstant()) };
	} catch {
		return null;
	}
};

/** `20261116T150000Z`, or `20261116` for an all-day date in `zone`: RFC 5545 basic format, as instance ids use it. */
export const basicFormat = (instant: string, allDay: boolean, zone: string): string => {
	if (allDay) return Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDate().toString().replaceAll('-', '');
	return Temporal.Instant.from(instant).toString({ smallestUnit: 'second' }).replace(/[-:]/g, '');
};

/** The id Google gives one occurrence of a recurring event: the series id and the occurrence's original start. */
export const instanceId = (seriesGoogleId: string, originalStartAt: string, allDay: boolean, zone: string): string => `${seriesGoogleId}_${basicFormat(originalStartAt, allDay, zone)}`;

/** A local id as a Google event id (base32hex, 5–1024 characters), so a retried insert finds the first one. */
export const googleEventIdFor = (localId: string): string | undefined => {
	const id = localId.toLowerCase().replace(/[^0-9a-v]/g, '');
	return id.length >= 5 ? id : undefined;
};

/** Parses `EXDATE[;params]:v1,v2` into UTC instants: UTC times, times in a TZID, or dates (midnight in `zone`). */
const exDatesOf = (line: string, zone: string): string[] => {
	const separator = line.indexOf(':');
	if (separator < 0) return [];
	const params = new Map(
		line
			.slice(0, separator)
			.split(';')
			.slice(1)
			.map(param => param.split('=', 2) as [string, string])
	);
	const tzid = params.get('TZID');
	const timeZone = tzid !== undefined && isValidTimeZone(tzid) ? tzid : zone;
	return line
		.slice(separator + 1)
		.split(',')
		.flatMap(value => {
			const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
			if (match === null) return [];
			const [, year, month, day, hour, minute, second, z] = match;
			const date = `${year}-${month}-${day}`;
			if (hour === undefined) return [utc(Temporal.PlainDate.from(date).toZonedDateTime(timeZone).toInstant())];
			const time = `${date}T${hour}:${minute}:${second}`;
			if (z !== undefined) return [utc(Temporal.Instant.from(`${time}Z`))];
			return [utc(Temporal.PlainDateTime.from(time).toZonedDateTime(timeZone, { disambiguation: 'compatible' }).toInstant())];
		});
};

const text = (value: string | null | undefined): string | null => (value == null || value.trim() === '' ? null : value);

const MEET = 'hangoutsMeet';

/**
 * Whether a Google event has a Google Meet, or one Google is still creating. An add-on conference (Zoom, Teams…)
 * isn't one, and a failed request left nothing.
 */
export const hasMeet = (event: Pick<GoogleEvent, 'conferenceData'>): boolean => {
	const conference = event.conferenceData;
	if (conference === undefined) return false;
	if (conference.conferenceSolution !== undefined) return conference.conferenceSolution.key.type === MEET;
	const request = conference.createRequest;
	return request?.conferenceSolutionKey?.type === MEET && request.status?.statusCode !== 'failure';
};

/** A Google event's attendees with an email, as Tempi keeps them. */
export const attendeesOf = (event: Pick<GoogleEvent, 'attendees'>): GoogleAttendee[] =>
	(event.attendees ?? []).flatMap(({ displayName, email, optional, organizer, resource, self }) => {
		const address = text(email);
		if (address === null) return [];
		return [
			{
				email: address,
				...(displayName !== undefined && { displayName }),
				...(optional !== undefined && { optional }),
				...(organizer !== undefined && { organizer }),
				...(resource !== undefined && { resource }),
				...(self !== undefined && { self }),
			},
		];
	});

/** Guests are the people invited: never the user, the organizer, nor a room or other resource. */
const isGuest = (attendee: GoogleAttendee): boolean => attendee.self !== true && attendee.organizer !== true && attendee.resource !== true;

const guestsOf = (attendees: GoogleAttendee[]): string[] => [...new Set(attendees.filter(isGuest).map(attendee => attendee.email.trim().toLowerCase()))];

/** The link to join a Google event's Meet; null while Google is still creating it, or when it has none. */
export const meetLinkOf = (event: Pick<GoogleEvent, 'conferenceData' | 'hangoutLink'>): string | null => {
	if (!hasMeet(event)) return null;
	const link = text(event.hangoutLink) ?? text(event.conferenceData?.entryPoints?.find(entry => entry.entryPointType === 'video')?.uri);
	return link !== null && VIDEO_URL.test(link) ? link : null;
};

/**
 * A Google event as Tempi event fields, or null when Tempi can't show it (no start, a status rather than an event).
 * All-day dates and floating times take the calendar's `zone`. Google's default reminders map to none.
 */
export const fromGoogle = (event: GoogleEvent, zone: string): PulledFields | null => {
	if (event.eventType !== undefined && SKIPPED_TYPES.has(event.eventType)) return null;
	if (event.start === undefined || event.end === undefined) return null;
	const eventZone = event.start.timeZone !== undefined && isValidTimeZone(event.start.timeZone) ? event.start.timeZone : zone;
	const start = instantOf(event.start, eventZone);
	const end = instantOf(event.end, eventZone);
	if (start === null || end === null) return null;

	const lines = event.recurrence ?? [];
	const rrule = lines.find(line => line.toUpperCase().startsWith('RRULE:')) ?? null;
	const exDates = lines.filter(line => line.toUpperCase().startsWith('EXDATE')).flatMap(line => exDatesOf(line, eventZone));

	const popup = event.reminders?.useDefault === true ? undefined : event.reminders?.overrides?.find(reminder => reminder.method === 'popup');
	const reminderMinutes = popup !== undefined && popup.minutes >= 0 && popup.minutes <= MAX_REMINDER_MINUTES ? popup.minutes : null;

	const googleMeet = hasMeet(event);
	const ownVideoUrl = event.extendedProperties?.private?.[VIDEO_URL_PROPERTY];
	// With a Meet, the event's video link is the Meet's; Tempi's own link only stands for other calls.
	const videoUrl = googleMeet ? meetLinkOf(event) : (text(ownVideoUrl) ?? text(event.hangoutLink));

	return {
		allDay: start.allDay,
		description: text(event.description),
		endAt: end.instant,
		exDates,
		googleMeet,
		guests: guestsOf(attendeesOf(event)),
		// Someone else's event only lets guests change when its organizer allows it.
		guestsReadOnly: event.organizer !== undefined && event.organizer.self !== true && event.guestsCanModify !== true,
		location: text(event.location),
		reminderMinutes,
		// Core strips the `RRULE:` prefix and checks the rule.
		rrule,
		startAt: start.instant,
		status: event.status === 'tentative' ? 'tentative' : 'confirmed',
		timeZone: eventZone,
		// Google allows events without a title; Tempi requires one.
		title: text(event.summary)?.trim() ?? '—',
		videoUrl: videoUrl !== null && VIDEO_URL.test(videoUrl) ? videoUrl : null,
	};
};

const timeOf = (instant: string, allDay: boolean, timeZone: string): GoogleEventTime =>
	allDay ? { date: Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDate().toString() } : { dateTime: instant, timeZone };

/**
 * The conference change to send: a Meet is asked for when the event wants one and Google's version (`remoteMeet`)
 * has none, and removed in the opposite case. Otherwise nothing is sent, so add-on conferences stay untouched. The
 * request id is the event's version, so a retried push asks for the same Meet instead of a second one.
 */
const conferenceOf = (event: CalendarEvent, remoteMeet: boolean): Pick<GoogleEventInput, 'conferenceData'> => {
	if (event.googleMeet === remoteMeet) return {};
	if (!event.googleMeet) return { conferenceData: null };
	return { conferenceData: { createRequest: { conferenceSolutionKey: { type: MEET }, requestId: `${event.id}-${event.updatedAt}` } } };
};

/** What Google's version of an event has, as last synced: nothing yet for an event Google doesn't have. */
export type RemoteState = Pick<GoogleEventLink, 'attendees' | 'meet'>;

export const NOT_ON_GOOGLE: RemoteState = { attendees: [], meet: false };

/**
 * The attendees to send, only when the guests changed: the ones Tempi doesn't show (the user, the organizer, rooms)
 * stay, and guests already invited keep their name and whether they are optional.
 */
const attendeesFor = (event: CalendarEvent, remote: GoogleAttendee[]): Pick<GoogleEventInput, 'attendees'> => {
	const invited = guestsOf(remote);
	if (event.guests.length === invited.length && event.guests.every(email => invited.includes(email))) return {};
	const kept = remote.filter(attendee => !isGuest(attendee));
	const guests = event.guests.map(email => remote.find(attendee => isGuest(attendee) && attendee.email.toLowerCase() === email) ?? { email });
	return {
		attendees: [...kept, ...guests].map(({ displayName, email, optional }) => ({
			email,
			...(displayName !== undefined && { displayName }),
			...(optional !== undefined && { optional }),
		})),
	};
};

/**
 * A local event as the fields Tempi writes on Google. A series sends its rule and the dates it skips (`exDates`,
 * without those of edited occurrences, which stay as Google exceptions); an edited occurrence sends no recurrence.
 * `remote` is what Google's version of the event has, so the Meet and the guests are only sent when they changed.
 */
export const toGoogle = (event: CalendarEvent, exDates: string[], remote: RemoteState): GoogleEventInput => {
	const body: GoogleEventInput = {
		...conferenceOf(event, remote.meet),
		...attendeesFor(event, remote.attendees),
		description: event.description,
		end: timeOf(event.endAt, event.allDay, event.timeZone),
		// With a Meet, Google holds the link; keeping it here too would outlive the Meet.
		extendedProperties: { private: { [VIDEO_URL_PROPERTY]: event.googleMeet ? '' : (event.videoUrl ?? '') } },
		location: event.location,
		reminders: { overrides: event.reminderMinutes === null ? [] : [{ method: 'popup', minutes: event.reminderMinutes }], useDefault: false },
		start: timeOf(event.startAt, event.allDay, event.timeZone),
		status: event.status,
		summary: event.title,
	};
	if (event.recurringEventId !== null) return body;
	if (event.rrule === null) return { ...body, recurrence: [] };
	const skipped = [...exDates].sort().map(date => (event.allDay ? `EXDATE;VALUE=DATE:${basicFormat(date, true, event.timeZone)}` : `EXDATE:${basicFormat(date, false, event.timeZone)}`));
	return { ...body, recurrence: [`RRULE:${event.rrule}`, ...skipped] };
};
