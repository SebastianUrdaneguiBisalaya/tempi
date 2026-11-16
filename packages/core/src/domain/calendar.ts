import { z } from 'zod';
import { storedEntitySchema } from './timestamps';
import { requiredTextSchema } from './values';

export const CALENDAR_SOURCES = ['local', 'google'] as const;

export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

const calendarShape = {
	/** Hex color `#rrggbb`, stored lowercase. */
	color: z
		.string()
		.regex(/^#[0-9a-f]{6}$/i, 'calendar.color')
		.transform(value => value.toLowerCase()),
	isDefault: z.boolean(),
	isVisible: z.boolean(),
	name: requiredTextSchema,
	source: z.enum(CALENDAR_SOURCES),
};

export const calendarFieldsSchema = z.object(calendarShape);

/** Input for a new calendar. `isDefault` is decided by the use case when omitted. */
export const newCalendarInputSchema = z.object({
	color: calendarShape.color,
	isDefault: calendarShape.isDefault.optional(),
	isVisible: calendarShape.isVisible.default(true),
	name: calendarShape.name,
	source: calendarShape.source.default('local'),
});

/** Fields the user may change. The source is fixed at creation. */
export const calendarPatchSchema = z.object(calendarShape).omit({ source: true }).partial();

export type CalendarFields = z.output<typeof calendarFieldsSchema>;
export type NewCalendarInput = z.input<typeof newCalendarInputSchema>;
export type CalendarPatch = z.input<typeof calendarPatchSchema>;

/** A stored calendar, as repositories save and return it. */
export const calendarSchema = calendarFieldsSchema.and(storedEntitySchema);

export type Calendar = z.output<typeof calendarSchema>;
