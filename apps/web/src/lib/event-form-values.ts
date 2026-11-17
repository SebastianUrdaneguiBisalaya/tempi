import {
	type CalendarEvent,
	EVENT_STATUSES,
	fromRrule,
	MONTHLY_MODES,
	newEventInputSchema,
	presetOf,
	presetRecurrence,
	RECURRENCE_ENDS,
	RECURRENCE_FREQUENCIES,
	RECURRENCE_PRESETS,
	type RecurrencePreset,
	recurrenceSchemaFor,
	toRrule,
	WEEKDAYS,
	zodErrorKeyMap,
} from '@tempi/core';
import { z } from 'zod';

/**
 * What the event form edits: times as wall-clock text in the event's time zone (`YYYY-MM-DDTHH:mm`, or
 * `YYYY-MM-DD` for all-day events, whose end day is inclusive). `eventFormSchema` turns them into UTC instants and
 * validates the result with core's `newEventInputSchema`, so every rule (and its message) comes from core.
 */
const eventFormValuesSchema = z.object({
	allDay: z.boolean(),
	calendarId: z.string(),
	description: z.string(),
	endAt: z.string(),
	location: z.string(),
	/** The custom rule's fields; read only when `repeat` is `custom`. */
	recurrence: z.object({
		count: z.number(),
		ends: z.enum(RECURRENCE_ENDS),
		frequency: z.enum(RECURRENCE_FREQUENCIES),
		interval: z.number(),
		monthlyMode: z.enum(MONTHLY_MODES),
		until: z.string(),
		weekdays: z.array(z.enum(WEEKDAYS)),
	}),
	reminderMinutes: z.number().nullable(),
	repeat: z.enum(RECURRENCE_PRESETS),
	startAt: z.string(),
	status: z.enum(EVENT_STATUSES),
	timeZone: z.string(),
	title: z.string(),
	/** Blank for none; core checks it is an http(s) URL. */
	videoUrl: z.string(),
});

export type EventFormValues = z.input<typeof eventFormValuesSchema>;

/** Wall-clock text to a UTC instant. Unparseable text passes through, so core reports it as an invalid instant. */
const toInstant = (value: string, timeZone: string, allDay: boolean, isEnd: boolean): string => {
	try {
		if (!allDay) return Temporal.PlainDateTime.from(value).toZonedDateTime(timeZone).toInstant().toString();
		const day = Temporal.PlainDate.from(value.slice(0, 10));
		// All-day ends are inclusive in the form and exclusive in storage.
		return (isEnd ? day.add({ days: 1 }) : day).toZonedDateTime({ timeZone }).toInstant().toString();
	} catch {
		return value;
	}
};

const PRESET_FREQUENCIES = { daily: 'DAILY', monthly: 'MONTHLY', weekly: 'WEEKLY', yearly: 'YEARLY' } as const;

/** The start as a zoned time, or null while the start or the time zone is invalid (core reports those). */
const zonedStart = (startAt: string, timeZone: string): Temporal.ZonedDateTime | null => {
	try {
		return Temporal.Instant.from(startAt).toZonedDateTimeISO(timeZone);
	} catch {
		return null;
	}
};

export const eventFormSchema = eventFormValuesSchema.transform((values, ctx) => {
	const { recurrence, repeat, ...fields } = values;
	const startAt = toInstant(values.startAt, values.timeZone, values.allDay, false);
	const start = zonedStart(startAt, values.timeZone);

	let rrule: string | null = null;
	let invalidRecurrence = false;
	if (repeat !== 'none' && start !== null) {
		if (repeat === 'custom') {
			const custom = recurrenceSchemaFor(start.toPlainDate()).safeParse(recurrence, { error: zodErrorKeyMap });
			if (custom.success) rrule = toRrule(custom.data, start);
			else {
				invalidRecurrence = true;
				for (const issue of custom.error.issues) ctx.addIssue({ ...issue, path: ['recurrence', ...issue.path] });
			}
		} else rrule = toRrule(presetRecurrence(PRESET_FREQUENCIES[repeat], start.toPlainDate()), start);
	}

	const parsed = newEventInputSchema.safeParse(
		{ ...fields, endAt: toInstant(values.endAt, values.timeZone, values.allDay, true), rrule, startAt },
		// Same error map the resolver uses, so built-in zod errors become core error keys here too.
		{ error: zodErrorKeyMap }
	);
	// Core's issues keep their paths (e.g. `endAt` for end before start), so they land on the form's fields.
	if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({ ...issue });
	return parsed.success && !invalidRecurrence ? parsed.data : z.NEVER;
});

export type EventFormOutput = z.output<typeof eventFormSchema>;

const MINUTE_PRECISION = { smallestUnit: 'minute' } as const;

/** A UTC instant as the form's wall-clock text in `timeZone`. */
export const toFormTime = (instant: string, timeZone: string, allDay: boolean, isEnd = false): string => {
	const time = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
	if (!allDay) return time.toPlainDateTime().toString(MINUTE_PRECISION);
	return (isEnd ? time.toPlainDate().subtract({ days: 1 }) : time.toPlainDate()).toString();
};

/** Switches the form's times between all-day dates and timed values, keeping the days. */
export const convertFormTimes = (values: Pick<EventFormValues, 'endAt' | 'startAt'>, allDay: boolean): Pick<EventFormValues, 'endAt' | 'startAt'> =>
	allDay ? { endAt: values.endAt.slice(0, 10), startAt: values.startAt.slice(0, 10) } : { endAt: `${values.endAt.slice(0, 10)}T10:00`, startAt: `${values.startAt.slice(0, 10)}T09:00` };

/** Repeat fields for an event starting at `startAt`: its rule as a preset or custom recurrence, or none. */
export const recurrenceFormValues = (rrule: string | null, startAt: string, timeZone: string): Pick<EventFormValues, 'recurrence' | 'repeat'> => {
	const start = Temporal.Instant.from(startAt).toZonedDateTimeISO(timeZone);
	const recurrence = (rrule === null ? null : fromRrule(rrule, start)) ?? presetRecurrence('WEEKLY', start.toPlainDate());
	const repeat: RecurrencePreset = presetOf(rrule, start);
	return { recurrence, repeat };
};

/** The fields the form shows, from a stored event or a new one not saved yet (an assistant proposal). */
type EventFormSource = Pick<CalendarEvent, 'allDay' | 'calendarId' | 'description' | 'endAt' | 'location' | 'reminderMinutes' | 'rrule' | 'startAt' | 'status' | 'timeZone' | 'title' | 'videoUrl'>;

export const eventToFormValues = (event: EventFormSource): EventFormValues => ({
	...recurrenceFormValues(event.rrule, event.startAt, event.timeZone),
	allDay: event.allDay,
	calendarId: event.calendarId,
	description: event.description ?? '',
	endAt: toFormTime(event.endAt, event.timeZone, event.allDay, true),
	location: event.location ?? '',
	reminderMinutes: event.reminderMinutes,
	startAt: toFormTime(event.startAt, event.timeZone, event.allDay),
	status: event.status,
	timeZone: event.timeZone,
	title: event.title,
	videoUrl: event.videoUrl ?? '',
});
