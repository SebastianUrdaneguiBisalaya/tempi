import { z } from 'zod';
import { type ErrorKey, isErrorKey } from './error-keys';
import { idSchema, timeZoneSchema, utcInstantSchema } from './values';

/** What the account may do in a Google calendar. Free/busy-only calendars carry no event details and aren't offered. */
export const GOOGLE_ACCESS_ROLES = ['owner', 'writer', 'reader'] as const;

export type GoogleAccessRole = (typeof GOOGLE_ACCESS_ROLES)[number];

/** Roles under which events sync both ways; any other syncs from Google only. */
export const isWritableRole = (role: GoogleAccessRole): boolean => role === 'owner' || role === 'writer';

/**
 * A calendar of the connected Google account, as the last sync listed it, and how it maps to Tempi: `selected` ones
 * sync into the local calendar `calendarId` (created on their first sync).
 */
export const googleCalendarLinkSchema = z.object({
	accessRole: z.enum(GOOGLE_ACCESS_ROLES),
	calendarId: idSchema.nullable(),
	/** `#rrggbb`, as Google shows the calendar. */
	color: z.string().regex(/^#[0-9a-f]{6}$/i),
	googleId: z.string().min(1),
	name: z.string(),
	primary: z.boolean(),
	selected: z.boolean(),
	/** Where the next incremental pull starts; null until the first full pull, or after Google expires it. */
	syncToken: z.string().min(1).nullable(),
	/** The calendar's zone, for its all-day events (Google dates carry none). */
	timeZone: timeZoneSchema,
});

export type GoogleCalendarLink = z.output<typeof googleCalendarLinkSchema>;

/**
 * A local event that has been synced with Google: where it lives there, the version Google last returned (`etag`), and
 * the local `updatedAt` that version matches. A later local `updatedAt` means a change still to push.
 */
export const googleEventLinkSchema = z.object({
	etag: z.string().min(1),
	eventId: idSchema,
	googleCalendarId: z.string().min(1),
	googleEventId: z.string().min(1),
	/** Whether that version has a Google Meet (or one being created), so a push only adds or removes it when it changed. */
	meet: z.boolean(),
	syncedUpdatedAt: utcInstantSchema,
});

export type GoogleEventLink = z.output<typeof googleEventLinkSchema>;

/** A Google calendar as the settings list it, to pick which ones sync. */
export const googleCalendarChoiceSchema = googleCalendarLinkSchema.pick({ accessRole: true, color: true, googleId: true, name: true, primary: true, selected: true });

export type GoogleCalendarChoice = z.output<typeof googleCalendarChoiceSchema>;

export const selectGoogleCalendarsInputSchema = z.object({ googleIds: z.array(z.string().min(1)) });

export type SelectGoogleCalendarsInput = z.input<typeof selectGoogleCalendarsInputSchema>;

export const GOOGLE_SYNC_STATES = ['idle', 'syncing', 'offline', 'error', 'reconnect'] as const;

export type GoogleSyncState = (typeof GOOGLE_SYNC_STATES)[number];

/** Where sync stands, for the settings and for toasts. `error` names what failed with an error key the UI translates. */
export const googleSyncStatusSchema = z.object({
	error: z.custom<ErrorKey>(value => typeof value === 'string' && isErrorKey(value)).nullable(),
	lastSyncedAt: utcInstantSchema.nullable(),
	state: z.enum(GOOGLE_SYNC_STATES),
});

export type GoogleSyncStatus = z.output<typeof googleSyncStatusSchema>;
