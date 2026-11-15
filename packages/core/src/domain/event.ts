import { fail, ok, type Result } from './result';
import type { Timestamps } from './timestamps';
import { isValidTimeZone, optionalText, toUtcInstant } from './values';

export const EVENT_STATUSES = ['confirmed', 'tentative'] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

// Named CalendarEvent so it never shadows the DOM `Event` in the renderer.
export type CalendarEvent = Timestamps & {
	allDay: boolean;
	calendarId: string;
	description: string | null;
	endAt: string;
	id: string;
	location: string | null;
	reminderMinutes: number | null;
	/** RFC 5545 RRULE value without the `RRULE:` prefix. */
	rrule: string | null;
	startAt: string;
	status: EventStatus;
	/** IANA time zone the event was created in. */
	timeZone: string;
	title: string;
	videoUrl: string | null;
};

export type EventFields = Omit<CalendarEvent, keyof Timestamps | 'id'>;

export type NewEventInput = {
	allDay?: boolean;
	calendarId: string;
	description?: string | null;
	endAt: string;
	location?: string | null;
	reminderMinutes?: number | null;
	rrule?: string | null;
	startAt: string;
	status?: EventStatus;
	timeZone: string;
	title: string;
	videoUrl?: string | null;
};

export type EventPatch = Partial<EventFields>;

const HTTP_URL = /^https?:\/\/\S+$/i;
const RRULE = /^(RRULE:)?FREQ=/i;

export const toEventFields = (input: NewEventInput): EventFields => ({
	allDay: input.allDay ?? false,
	calendarId: input.calendarId,
	description: input.description ?? null,
	endAt: input.endAt,
	location: input.location ?? null,
	reminderMinutes: input.reminderMinutes ?? null,
	rrule: input.rrule ?? null,
	startAt: input.startAt,
	status: input.status ?? 'confirmed',
	timeZone: input.timeZone,
	title: input.title,
	videoUrl: input.videoUrl ?? null,
});

/** Validates event fields and normalizes them (trimmed text, UTC instants, bare RRULE). */
export const validateEventFields = (fields: EventFields): Result<EventFields> => {
	const title = fields.title.trim();
	if (title === '') return fail('validation', 'Title is required', 'title');

	if (fields.calendarId.trim() === '') return fail('validation', 'Calendar is required', 'calendarId');

	const startAt = toUtcInstant(fields.startAt);
	if (startAt === null) return fail('validation', 'Start must be an ISO-8601 instant with offset', 'startAt');
	const endAt = toUtcInstant(fields.endAt);
	if (endAt === null) return fail('validation', 'End must be an ISO-8601 instant with offset', 'endAt');
	if (endAt <= startAt) return fail('validation', 'End must be after start', 'endAt');

	if (!isValidTimeZone(fields.timeZone)) return fail('validation', 'Time zone must be a valid IANA zone', 'timeZone');

	if (!EVENT_STATUSES.includes(fields.status)) return fail('validation', 'Status must be confirmed or tentative', 'status');

	const videoUrl = optionalText(fields.videoUrl);
	if (videoUrl !== null && !HTTP_URL.test(videoUrl)) return fail('validation', 'Video URL must be an http(s) URL', 'videoUrl');

	const rruleText = optionalText(fields.rrule);
	if (rruleText !== null && !RRULE.test(rruleText)) return fail('validation', 'Recurrence must be an RFC 5545 RRULE', 'rrule');

	const { reminderMinutes } = fields;
	if (reminderMinutes !== null && (!Number.isInteger(reminderMinutes) || reminderMinutes < 0)) {
		return fail('validation', 'Reminder must be a non-negative whole number of minutes', 'reminderMinutes');
	}

	return ok({
		allDay: fields.allDay,
		calendarId: fields.calendarId,
		description: optionalText(fields.description),
		endAt,
		location: optionalText(fields.location),
		reminderMinutes,
		rrule: rruleText?.replace(/^RRULE:/i, '') ?? null,
		startAt,
		status: fields.status,
		timeZone: fields.timeZone,
		title,
		videoUrl,
	});
};
