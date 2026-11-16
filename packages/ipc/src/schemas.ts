import {
	calendarEventSchema,
	calendarPatchSchema,
	calendarSchema,
	DOMAIN_ERROR_CODES,
	dateRangeSchema,
	type ErrorKey,
	eventOccurrenceSchema,
	eventPatchSchema,
	idSchema,
	isErrorKey,
	newCalendarInputSchema,
	newEventInputSchema,
	occurrenceTargetSchema,
	onboardingInputSchema,
	profileInputSchema,
	settingsPatchSchema,
	settingsSchema,
	userProfileSchema,
} from '@tempi/core';
import { z } from 'zod';
import type { Channel } from './channels';

const noPayload = z.undefined();

/**
 * What the renderer sends on each channel: the core use case input. The main process parses every payload with these.
 * Updates carry the id next to the patch fields, so field errors keep the same paths the forms use (`title`, not `patch.title`).
 */
export const payloadSchemas = {
	'calendars:create': newCalendarInputSchema,
	'calendars:delete': idSchema,
	'calendars:list': noPayload,
	'calendars:update': calendarPatchSchema.extend({ id: idSchema }),
	'events:create': newEventInputSchema,
	'events:delete': idSchema,
	'events:deleteOccurrence': occurrenceTargetSchema,
	'events:duplicate': idSchema,
	'events:list': dateRangeSchema,
	'events:restore': idSchema,
	'events:update': eventPatchSchema.extend({ id: idSchema }),
	'events:updateOccurrence': eventPatchSchema.extend(occurrenceTargetSchema.shape),
	'onboarding:complete': onboardingInputSchema,
	'profile:get': noPayload,
	'profile:save': profileInputSchema,
	'settings:get': noPayload,
	'settings:save': settingsPatchSchema,
} as const satisfies Record<Channel, z.ZodType>;

/** The value inside a successful result on each channel. The renderer parses responses with these. */
export const responseValueSchemas = {
	'calendars:create': calendarSchema,
	'calendars:delete': z.null(),
	'calendars:list': z.array(calendarSchema),
	'calendars:update': calendarSchema,
	'events:create': calendarEventSchema,
	'events:delete': z.null(),
	'events:deleteOccurrence': z.null(),
	'events:duplicate': calendarEventSchema,
	'events:list': z.array(eventOccurrenceSchema),
	'events:restore': calendarEventSchema,
	'events:update': calendarEventSchema,
	'events:updateOccurrence': eventOccurrenceSchema,
	'onboarding:complete': z.object({ profile: userProfileSchema, settings: settingsSchema }),
	'profile:get': userProfileSchema.nullable(),
	'profile:save': userProfileSchema,
	'settings:get': settingsSchema,
	'settings:save': settingsSchema,
} as const satisfies Record<Channel, z.ZodType>;

/** What a caller passes on a channel. */
export type ChannelInput<C extends Channel> = z.input<(typeof payloadSchemas)[C]>;
/** What a handler receives on a channel, once parsed. */
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
