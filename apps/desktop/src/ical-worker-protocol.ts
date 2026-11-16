import { calendarEventSchema, calendarSchema, importedEventSchema } from '@tempi/core';
import { resultSchema } from '@tempi/ipc';
import { z } from 'zod';

/** Messages between the main process and the iCalendar utility process. Both sides validate what they receive. */
export const icalWorkerRequestSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('parse'), options: z.object({ defaultDurationMinutes: z.number().int().positive(), timeZone: z.string() }), text: z.string() }),
	z.object({ data: z.object({ calendars: z.array(calendarSchema), events: z.array(calendarEventSchema) }), kind: z.literal('serialize'), now: z.string() }),
]);

export type IcalWorkerRequest = z.input<typeof icalWorkerRequestSchema>;

export const icalWorkerResponseSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('parsed'), result: resultSchema(z.object({ events: z.array(importedEventSchema), skipped: z.number().int() })) }),
	z.object({ kind: z.literal('serialized'), text: z.string() }),
	z.object({ detail: z.string(), kind: z.literal('failed') }),
]);

export type IcalWorkerResponse = z.output<typeof icalWorkerResponseSchema>;
