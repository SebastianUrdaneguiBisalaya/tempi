import {
	appUpdateStatusSchema,
	calendarEventSchema,
	calendarPatchSchema,
	calendarSchema,
	DOMAIN_ERROR_CODES,
	dateRangeSchema,
	deleteCalendarInputSchema,
	type ErrorKey,
	eventOccurrenceSchema,
	eventPatchSchema,
	eventSearchQuerySchema,
	exportEventsInputSchema,
	googleAccountSchema,
	googleCalendarChoiceSchema,
	googleConnectResultSchema,
	googleSyncStatusSchema,
	idSchema,
	isErrorKey,
	newCalendarInputSchema,
	newEventInputSchema,
	occurrenceTargetSchema,
	onboardingInputSchema,
	profileUpdateInputSchema,
	selectGoogleCalendarsInputSchema,
	settingsPatchSchema,
	settingsSchema,
	userProfileSchema,
	utcInstantSchema,
} from '@tempi/core';
import { z } from 'zod';
import type { Channel } from './channels';

const noPayload = z.undefined();

/** An occurrence to show: its listing key and start, enough to find it again in the renderer. */
export const occurrenceRefSchema = z.object({ key: z.string().min(1), startAt: utcInstantSchema });

export type OccurrenceRef = z.output<typeof occurrenceRefSchema>;

/**
 * What the renderer sends on each channel: the core use case input. The main process parses every payload with these.
 * Updates carry the id next to the patch fields, so field errors keep the same paths the forms use (`title`, not `patch.title`).
 */
/** An import picks its file in a native dialog, which the user can cancel. */
export const importResultSchema = z.discriminatedUnion('status', [
	z.object({ status: z.literal('canceled') }),
	z.object({ created: z.number().int(), skipped: z.number().int(), status: z.literal('imported'), updated: z.number().int() }),
]);

export type ImportResult = z.output<typeof importResultSchema>;

export const exportResultSchema = z.discriminatedUnion('status', [z.object({ status: z.literal('canceled') }), z.object({ count: z.number().int(), status: z.literal('exported') })]);

export type ExportResult = z.output<typeof exportResultSchema>;

/** Backup and restore pick their file in a native dialog, which the user can cancel. A restore relaunches the app. */
export const backupResultSchema = z.discriminatedUnion('status', [z.object({ status: z.literal('canceled') }), z.object({ status: z.literal('saved') })]);
export const restoreResultSchema = z.discriminatedUnion('status', [z.object({ status: z.literal('canceled') }), z.object({ status: z.literal('restarting') })]);

export const payloadSchemas = {
	'app:showEvent': occurrenceRefSchema,
	'calendars:create': newCalendarInputSchema,
	'calendars:delete': deleteCalendarInputSchema,
	'calendars:export': exportEventsInputSchema,
	'calendars:import': z.object({ calendarId: idSchema }),
	'calendars:list': noPayload,
	'calendars:update': calendarPatchSchema.extend({ id: idSchema }),
	'data:backup': noPayload,
	'data:restore': noPayload,
	'events:create': newEventInputSchema,
	'events:delete': idSchema,
	'events:deleteOccurrence': occurrenceTargetSchema,
	'events:duplicate': idSchema,
	'events:list': dateRangeSchema,
	'events:restore': idSchema,
	'events:search': eventSearchQuerySchema,
	'events:update': eventPatchSchema.extend({ id: idSchema }),
	'events:updateOccurrence': eventPatchSchema.extend(occurrenceTargetSchema.shape),
	'google:account': noPayload,
	'google:calendars': noPayload,
	'google:connect': noPayload,
	'google:disconnect': noPayload,
	'google:selectCalendars': selectGoogleCalendarsInputSchema,
	'google:sync': noPayload,
	'google:syncStatus': noPayload,
	'onboarding:complete': onboardingInputSchema,
	'profile:get': noPayload,
	'profile:update': profileUpdateInputSchema,
	'settings:get': noPayload,
	'settings:save': settingsPatchSchema,
	'updates:check': noPayload,
	'updates:install': noPayload,
	'updates:status': noPayload,
} as const satisfies Record<Channel, z.ZodType>;

/** The value inside a successful result on each channel. The renderer parses responses with these. */
export const responseValueSchemas = {
	'app:showEvent': z.null(),
	'calendars:create': calendarSchema,
	'calendars:delete': z.null(),
	'calendars:export': exportResultSchema,
	'calendars:import': importResultSchema,
	'calendars:list': z.array(calendarSchema),
	'calendars:update': calendarSchema,
	'data:backup': backupResultSchema,
	'data:restore': restoreResultSchema,
	'events:create': calendarEventSchema,
	'events:delete': z.null(),
	'events:deleteOccurrence': z.null(),
	'events:duplicate': calendarEventSchema,
	'events:list': z.array(eventOccurrenceSchema),
	'events:restore': calendarEventSchema,
	'events:search': z.array(eventOccurrenceSchema),
	'events:update': calendarEventSchema,
	'events:updateOccurrence': eventOccurrenceSchema,
	'google:account': googleAccountSchema.nullable(),
	'google:calendars': z.array(googleCalendarChoiceSchema),
	'google:connect': googleConnectResultSchema,
	'google:disconnect': z.null(),
	'google:selectCalendars': z.array(googleCalendarChoiceSchema),
	'google:sync': googleSyncStatusSchema,
	'google:syncStatus': googleSyncStatusSchema,
	'onboarding:complete': z.object({ profile: userProfileSchema, settings: settingsSchema }),
	'profile:get': userProfileSchema.nullable(),
	'profile:update': userProfileSchema,
	'settings:get': settingsSchema,
	'settings:save': settingsSchema,
	'updates:check': appUpdateStatusSchema,
	'updates:install': z.null(),
	'updates:status': appUpdateStatusSchema,
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
