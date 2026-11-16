import { calendarEventSchema, calendarSchema, DOMAIN_ERROR_CODES, dateRangeSchema, type ErrorKey, idSchema, isErrorKey, settingsSchema, userProfileSchema, utcInstantSchema } from '@tempi/core';
import { z } from 'zod';
import type { Channel } from './channels';

const noPayload = z.undefined();

/** What the renderer sends on each channel. The main process parses every payload with these before touching storage. */
export const payloadSchemas = {
	'calendars:get': idSchema,
	'calendars:list': noPayload,
	'calendars:save': calendarSchema,
	'events:deleteByCalendar': z.object({ calendarId: idSchema, deletedAt: utcInstantSchema }),
	'events:get': idSchema,
	'events:list': dateRangeSchema,
	'events:save': calendarEventSchema,
	'profile:get': noPayload,
	'profile:save': userProfileSchema,
	'settings:get': noPayload,
	'settings:save': settingsSchema,
} as const satisfies Record<Channel, z.ZodType>;

/** The value inside a successful result on each channel. The renderer parses responses with these. */
export const responseValueSchemas = {
	'calendars:get': calendarSchema.nullable(),
	'calendars:list': z.array(calendarSchema),
	'calendars:save': z.null(),
	'events:deleteByCalendar': z.null(),
	'events:get': calendarEventSchema.nullable(),
	'events:list': z.array(calendarEventSchema),
	'events:save': z.null(),
	'profile:get': userProfileSchema.nullable(),
	'profile:save': z.null(),
	'settings:get': settingsSchema.nullable(),
	'settings:save': z.null(),
} as const satisfies Record<Channel, z.ZodType>;

export type ChannelPayload<C extends Channel> = z.output<(typeof payloadSchemas)[C]>;
export type ChannelValue<C extends Channel> = z.output<(typeof responseValueSchemas)[C]>;

const domainIssueSchema = z.object({
	detail: z.string(),
	field: z.string().optional(),
	key: z.custom<ErrorKey>(value => typeof value === 'string' && isErrorKey(value)),
	params: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export const domainErrorSchema = z.object({
	code: z.enum(DOMAIN_ERROR_CODES),
	issues: z.array(domainIssueSchema).min(1),
});

/** A core `Result` carrying `value`, as it crosses IPC. */
export const resultSchema = <S extends z.ZodType>(value: S) => z.discriminatedUnion('ok', [z.object({ ok: z.literal(true), value }), z.object({ error: domainErrorSchema, ok: z.literal(false) })]);
