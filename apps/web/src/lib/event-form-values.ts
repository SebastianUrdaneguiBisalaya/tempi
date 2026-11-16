import { type CalendarEvent, newEventInputSchema, zodErrorKeyMap } from '@tempi/core';
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
	reminderMinutes: z.number().nullable(),
	startAt: z.string(),
	timeZone: z.string(),
	title: z.string(),
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

export const eventFormSchema = eventFormValuesSchema.transform((values, ctx) => {
	const parsed = newEventInputSchema.safeParse(
		{ ...values, endAt: toInstant(values.endAt, values.timeZone, values.allDay, true), startAt: toInstant(values.startAt, values.timeZone, values.allDay, false) },
		// Same error map the resolver uses, so built-in zod errors become core error keys here too.
		{ error: zodErrorKeyMap }
	);
	if (parsed.success) return parsed.data;
	// Core's issues keep their paths (e.g. `endAt` for end before start), so they land on the form's fields.
	for (const issue of parsed.error.issues) ctx.addIssue({ ...issue });
	return z.NEVER;
});

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

export const eventToFormValues = (event: CalendarEvent): EventFormValues => ({
	allDay: event.allDay,
	calendarId: event.calendarId,
	description: event.description ?? '',
	endAt: toFormTime(event.endAt, event.timeZone, event.allDay, true),
	location: event.location ?? '',
	reminderMinutes: event.reminderMinutes,
	startAt: toFormTime(event.startAt, event.timeZone, event.allDay),
	timeZone: event.timeZone,
	title: event.title,
});
