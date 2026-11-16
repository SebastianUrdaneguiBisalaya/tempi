import { z } from 'zod';
import { storedEntitySchema } from './timestamps';
import { idSchema, requiredTextSchema } from './values';

/**
 * Calendar colors offered by default: mid-tone hues that stay readable as text tints and bars on both the light and
 * the dark theme. Any other `#rrggbb` is allowed as a custom color.
 */
export const CALENDAR_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'] as const;

/** A random palette color no calendar uses yet, or any palette color once all are taken. `random` returns [0, 1). */
export const pickCalendarColor = (usedColors: readonly string[], random: () => number = Math.random): string => {
	const used = new Set(usedColors.map(color => color.toLowerCase()));
	const unused = CALENDAR_PALETTE.filter(color => !used.has(color));
	const choices = unused.length > 0 ? unused : CALENDAR_PALETTE;
	return choices[Math.floor(random() * choices.length)] ?? CALENDAR_PALETTE[0];
};

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
	/** A synced calendar the account may only read (e.g. holidays, a shared calendar): its events can't change in Tempi. */
	readOnly: z.boolean(),
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

/** Fields the user may change. The source is fixed at creation, and only sync decides what is read-only. */
export const calendarPatchSchema = z.object(calendarShape).omit({ readOnly: true, source: true }).partial();

export type CalendarFields = z.output<typeof calendarFieldsSchema>;
export type NewCalendarInput = z.input<typeof newCalendarInputSchema>;
export type CalendarPatch = z.input<typeof calendarPatchSchema>;

/** A stored calendar, as repositories save and return it. */
export const calendarSchema = calendarFieldsSchema.and(storedEntitySchema);

export type Calendar = z.output<typeof calendarSchema>;

/** Deleting a calendar either moves its events to another calendar or deletes them with it (`moveEventsTo: null`). */
export const deleteCalendarInputSchema = z.object({ id: idSchema, moveEventsTo: idSchema.nullable() });

export type DeleteCalendarInput = z.input<typeof deleteCalendarInputSchema>;
