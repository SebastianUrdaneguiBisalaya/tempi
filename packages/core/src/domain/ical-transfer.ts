import { z } from 'zod';
import { idSchema } from './values';

/**
 * Event fields as read from an iCalendar file: the keys of a new event's input (without `calendarId`), still
 * unvalidated. The import use case checks each event with `newEventInputSchema`, so the rules stay in one place.
 */
const importedFieldsSchema = z.record(z.string(), z.unknown());

/** One event of an iCalendar file: a single event or a series, with its exceptions. */
export const importedEventSchema = z.object({
	/** Original starts the series skips (EXDATE), as UTC instants. */
	exDates: z.array(z.string()),
	fields: importedFieldsSchema,
	/** Occurrences of the series changed on their own (VEVENTs with a RECURRENCE-ID). */
	overrides: z.array(z.object({ fields: importedFieldsSchema, originalStartAt: z.string() })),
	/** The file's UID; null when it has none, so the event can only be added. */
	uid: z.string().min(1).nullable(),
});

export type ImportedEvent = z.output<typeof importedEventSchema>;

export const importEventsInputSchema = z.object({ calendarId: idSchema, events: z.array(importedEventSchema) });

export type ImportEventsInput = z.input<typeof importEventsInputSchema>;

/** What an import did: events added, events updated (same UID already in the calendar), and parts left out as invalid. */
export type ImportSummary = { created: number; skipped: number; updated: number };

/** Export one calendar, or every calendar when `calendarId` is null. */
export const exportEventsInputSchema = z.object({ calendarId: idSchema.nullable() });

export type ExportEventsInput = z.input<typeof exportEventsInputSchema>;
