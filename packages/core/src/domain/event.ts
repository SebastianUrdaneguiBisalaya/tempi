import { z } from 'zod';
import { isValidRrule } from './recurrence';
import { storedEntitySchema } from './timestamps';
import { idSchema, optionalTextSchema, requiredTextSchema, timeZoneSchema, utcInstantSchema } from './values';

export const EVENT_STATUSES = ['confirmed', 'tentative'] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

/** The earliest a reminder may fire: a week before the start. Bounds how far ahead reminders must be looked for. */
export const MAX_REMINDER_MINUTES = 7 * 24 * 60;

const eventShape = {
	allDay: z.boolean(),
	calendarId: idSchema,
	description: optionalTextSchema,
	endAt: utcInstantSchema,
	location: optionalTextSchema,
	reminderMinutes: z
		.number()
		.int('validation.integer')
		.min(0, 'validation.min')
		.max(MAX_REMINDER_MINUTES, 'validation.max')
		.nullish()
		.transform(value => value ?? null),
	/** Stored without the `RRULE:` prefix. */
	rrule: optionalTextSchema.transform(value => value?.replace(/^RRULE:/i, '') ?? null).refine(value => value === null || isValidRrule(value), 'event.rrule'),
	startAt: utcInstantSchema,
	status: z.enum(EVENT_STATUSES),
	/** IANA time zone the event was created in. */
	timeZone: timeZoneSchema,
	title: requiredTextSchema,
	videoUrl: optionalTextSchema.refine(value => value === null || /^https?:\/\/\S+$/i.test(value), 'validation.url'),
};

/**
 * Links between a recurring series and its exceptions. Set only by use cases, never by input: a series keeps the
 * original starts of occurrences that were deleted or edited on their own (`exDates`), and each edited occurrence
 * is its own event pointing at its series and the start it replaces.
 */
const seriesShape = {
	exDates: z.array(utcInstantSchema),
	/** Start of the series occurrence this event replaces. */
	originalStartAt: utcInstantSchema.nullable(),
	recurringEventId: idSchema.nullable(),
};

const endAfterStart = { message: 'event.endBeforeStart', path: ['endAt'] };

/** Every event field, fully specified. Used to re-validate after merging a patch. */
export const eventFieldsSchema = z.object({ ...eventShape, ...seriesShape }).refine(event => event.endAt > event.startAt, endAfterStart);

/** Input for a new event: optional fields default to null, `allDay` to false and `status` to confirmed. */
export const newEventInputSchema = z
	.object({ ...eventShape, allDay: eventShape.allDay.default(false), status: eventShape.status.default('confirmed') })
	.refine(event => event.endAt > event.startAt, endAfterStart);

/** Shape check for a partial update. Cross-field rules run after merging, with `eventFieldsSchema`. */
export const eventPatchSchema = z.object(eventShape).partial();

export type EventFields = z.output<typeof eventFieldsSchema>;
export type NewEventInput = z.input<typeof newEventInputSchema>;
export type EventPatch = z.input<typeof eventPatchSchema>;

/** A stored event, as repositories save and return it. */
export const calendarEventSchema = eventFieldsSchema.and(storedEntitySchema);

// Named CalendarEvent so it never shadows the DOM `Event` in the renderer.
export type CalendarEvent = z.output<typeof calendarEventSchema>;

/** Fields of a new stored event that isn't part of a series. */
export const NO_SERIES = { exDates: [], originalStartAt: null, recurringEventId: null } as const satisfies Pick<CalendarEvent, keyof typeof seriesShape>;

/**
 * An event as views list it: a single event, an edited occurrence (its own event), or one occurrence of a series,
 * which carries the series' id and fields with the occurrence's times.
 */
export const eventOccurrenceSchema = calendarEventSchema.and(
	z.object({
		/** Unique among listed occurrences, for keys and focus: the event id, plus the start for a series occurrence. */
		key: z.string(),
		/** The series and the original start, for any occurrence of a recurring event. */
		series: z.object({ id: idSchema, originalStartAt: utcInstantSchema }).nullable(),
	})
);

export type EventOccurrence = z.output<typeof eventOccurrenceSchema>;

/** How far an edit or delete of an occurrence reaches. */
export const OCCURRENCE_SCOPES = ['this', 'following', 'all'] as const;
export type OccurrenceScope = (typeof OCCURRENCE_SCOPES)[number];

/** Which occurrence of which series, and how far the change reaches. */
export const occurrenceTargetSchema = z.object({
	originalStartAt: utcInstantSchema,
	scope: z.enum(OCCURRENCE_SCOPES),
	seriesId: idSchema,
});

export type OccurrenceTarget = z.input<typeof occurrenceTargetSchema>;
