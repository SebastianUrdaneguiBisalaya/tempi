import { z } from 'zod';
import { storedEntitySchema } from './timestamps';
import { idSchema, optionalTextSchema, requiredTextSchema, timeZoneSchema, utcInstantSchema } from './values';

export const EVENT_STATUSES = ['confirmed', 'tentative'] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

const RRULE = /^(RRULE:)?FREQ=/i;

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
		.nullish()
		.transform(value => value ?? null),
	/** Stored without the `RRULE:` prefix. */
	rrule: optionalTextSchema.refine(value => value === null || RRULE.test(value), 'event.rrule').transform(value => value?.replace(/^RRULE:/i, '') ?? null),
	startAt: utcInstantSchema,
	status: z.enum(EVENT_STATUSES),
	/** IANA time zone the event was created in. */
	timeZone: timeZoneSchema,
	title: requiredTextSchema,
	videoUrl: optionalTextSchema.refine(value => value === null || /^https?:\/\/\S+$/i.test(value), 'validation.url'),
};

const endAfterStart = { message: 'event.endBeforeStart', path: ['endAt'] };

/** Every event field, fully specified. Used to re-validate after merging a patch. */
export const eventFieldsSchema = z.object(eventShape).refine(event => event.endAt > event.startAt, endAfterStart);

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
