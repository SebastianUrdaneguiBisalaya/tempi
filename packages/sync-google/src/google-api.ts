import { z } from 'zod';

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

/** How long one request may take, body included, before Google counts as unreachable and the sync ends as offline. */
export const GOOGLE_REQUEST_TIMEOUT_MS = 30_000;

/** The subset of `fetch` the client uses, so tests can stand in for Google. */
export type GoogleFetch = (
	url: string,
	init: { body?: string; headers: Record<string, string>; method: 'DELETE' | 'GET' | 'PATCH' | 'POST'; signal: AbortSignal }
) => Promise<{ json: () => Promise<unknown>; ok: boolean; status: number }>;

/** Google couldn't be reached at all: sync waits for the connection to come back. */
export class GoogleOfflineError extends Error {
	override name = 'GoogleOfflineError';
}

/** The grant is gone, revoked or lacks a scope: the account must be connected again. */
export class GoogleAuthError extends Error {
	override name = 'GoogleAuthError';
}

/** Any other refusal from Google; `status` is the HTTP status. */
export class GoogleApiError extends Error {
	override name = 'GoogleApiError';
	readonly status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

/** The sync token is too old (410): the calendar needs a full pull. */
export class SyncTokenExpiredError extends Error {
	override name = 'SyncTokenExpiredError';
}

const calendarListEntrySchema = z.object({
	accessRole: z.string(),
	backgroundColor: z.string().optional(),
	deleted: z.boolean().optional(),
	id: z.string().min(1),
	primary: z.boolean().optional(),
	summary: z.string().optional(),
	summaryOverride: z.string().optional(),
	timeZone: z.string().optional(),
});

export type GoogleCalendarListEntry = z.output<typeof calendarListEntrySchema>;

const eventTimeSchema = z.object({ date: z.string().optional(), dateTime: z.string().optional(), timeZone: z.string().optional() });

export type GoogleEventTime = z.output<typeof eventTimeSchema>;

const googleEventSchema = z.object({
	description: z.string().nullish(),
	end: eventTimeSchema.optional(),
	etag: z.string().min(1),
	eventType: z.string().optional(),
	extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional(),
	hangoutLink: z.string().optional(),
	id: z.string().min(1),
	location: z.string().nullish(),
	originalStartTime: eventTimeSchema.optional(),
	recurrence: z.array(z.string()).optional(),
	recurringEventId: z.string().optional(),
	reminders: z.object({ overrides: z.array(z.object({ method: z.string(), minutes: z.number() })).optional(), useDefault: z.boolean().optional() }).optional(),
	start: eventTimeSchema.optional(),
	status: z.string().optional(),
	summary: z.string().nullish(),
	updated: z.string().optional(),
});

export type GoogleEvent = z.output<typeof googleEventSchema>;

/** What Tempi writes on a Google event. Fields it doesn't model (attendees, conferences) are left untouched. */
export type GoogleEventBody = {
	description: string | null;
	end: GoogleEventTime;
	extendedProperties: { private: Record<string, string> };
	id?: string;
	location: string | null;
	recurrence?: string[];
	reminders: { overrides: { method: 'popup'; minutes: number }[]; useDefault: false };
	start: GoogleEventTime;
	status: 'confirmed' | 'tentative';
	summary: string;
};

const pageSchema = <S extends z.ZodType>(item: S) =>
	z.object({ items: z.array(z.unknown()).optional(), nextPageToken: z.string().optional(), nextSyncToken: z.string().optional() }).transform(page => ({
		...page,
		// Items Tempi can't read (an unknown shape) are dropped one by one instead of failing the whole page.
		items: (page.items ?? []).flatMap(value => {
			const parsed = item.safeParse(value);
			return parsed.success ? [parsed.data as z.output<S>] : [];
		}),
	}));

const calendarPageSchema = pageSchema(calendarListEntrySchema);
const eventPageSchema = pageSchema(googleEventSchema);

export type GoogleCalendarApi = {
	listCalendars: () => Promise<GoogleCalendarListEntry[]>;
	/** Every change since `syncToken` (deleted events included), or every event when it is null; all pages. */
	listEvents: (calendarId: string, syncToken: string | null) => Promise<{ items: GoogleEvent[]; nextSyncToken: string }>;
	insertEvent: (calendarId: string, body: GoogleEventBody) => Promise<GoogleEvent>;
	patchEvent: (calendarId: string, eventId: string, body: GoogleEventBody) => Promise<GoogleEvent>;
	/** Deletes an event, or cancels an occurrence when `eventId` is an instance id. One already gone counts as deleted. */
	deleteEvent: (calendarId: string, eventId: string) => Promise<void>;
};

const path = (...segments: string[]) => segments.map(encodeURIComponent).join('/');

/** Google Calendar API v3 over `fetch`, authorized with a fresh access token on every request. */
export const createGoogleCalendarApi = (options: { accessToken: () => Promise<string>; fetch: GoogleFetch; timeoutMs?: number }): GoogleCalendarApi => {
	const request = async (method: 'DELETE' | 'GET' | 'PATCH' | 'POST', url: string, body?: object): Promise<{ json: unknown; status: number }> => {
		const headers: Record<string, string> = { Authorization: `Bearer ${await options.accessToken()}` };
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		// Without a deadline, a connection that drops mid-request leaves the sync (and its spinner) running forever.
		const signal = AbortSignal.timeout(options.timeoutMs ?? GOOGLE_REQUEST_TIMEOUT_MS);
		let response: Awaited<ReturnType<GoogleFetch>>;
		let json: unknown;
		try {
			response = await options.fetch(url, { body: body === undefined ? undefined : JSON.stringify(body), headers, method, signal });
			// A body that isn't JSON reads as null; one cut off by the deadline is a lost connection.
			json =
				response.status === 204
					? null
					: await response.json().catch((error: unknown) => {
							if (signal.aborted) throw error;
							return null;
						});
		} catch (error) {
			throw new GoogleOfflineError(`${method} ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (response.ok) return { json, status: response.status };
		if (response.status === 401) throw new GoogleAuthError(`${method} ${url} was refused: ${JSON.stringify(json)}`);
		// Missing scopes come back as 403 "insufficientPermissions"; quota errors also use 403, so tell them apart.
		if (response.status === 403 && JSON.stringify(json).includes('insufficient')) throw new GoogleAuthError(`${method} ${url} lacks a scope: ${JSON.stringify(json)}`);
		throw new GoogleApiError(response.status, `${method} ${url} failed with ${response.status}: ${JSON.stringify(json)}`);
	};

	const parseEvent = (json: unknown): GoogleEvent => {
		const parsed = googleEventSchema.safeParse(json);
		if (!parsed.success) throw new GoogleApiError(200, `Unexpected event from Google: ${parsed.error.message}`);
		return parsed.data;
	};

	return {
		deleteEvent: async (calendarId, eventId) => {
			try {
				await request('DELETE', `${BASE_URL}/${path('calendars', calendarId, 'events', eventId)}`);
			} catch (error) {
				if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) return;
				throw error;
			}
		},
		insertEvent: async (calendarId, body) => parseEvent((await request('POST', `${BASE_URL}/${path('calendars', calendarId, 'events')}`, body)).json),
		listCalendars: async () => {
			const entries: GoogleCalendarListEntry[] = [];
			let pageToken: string | undefined;
			do {
				const url = new URL(`${BASE_URL}/users/me/calendarList`);
				url.searchParams.set('minAccessRole', 'reader');
				if (pageToken !== undefined) url.searchParams.set('pageToken', pageToken);
				const page = calendarPageSchema.parse((await request('GET', url.toString())).json);
				entries.push(...page.items);
				pageToken = page.nextPageToken;
			} while (pageToken !== undefined);
			return entries;
		},
		listEvents: async (calendarId, syncToken) => {
			const items: GoogleEvent[] = [];
			let pageToken: string | undefined;
			for (;;) {
				const url = new URL(`${BASE_URL}/${path('calendars', calendarId, 'events')}`);
				url.searchParams.set('maxResults', '2500');
				url.searchParams.set('showDeleted', 'true');
				if (syncToken !== null) url.searchParams.set('syncToken', syncToken);
				if (pageToken !== undefined) url.searchParams.set('pageToken', pageToken);
				let json: unknown;
				try {
					json = (await request('GET', url.toString())).json;
				} catch (error) {
					if (error instanceof GoogleApiError && error.status === 410) throw new SyncTokenExpiredError(error.message);
					throw error;
				}
				const page = eventPageSchema.parse(json);
				items.push(...page.items);
				if (page.nextPageToken !== undefined) pageToken = page.nextPageToken;
				else if (page.nextSyncToken !== undefined) return { items, nextSyncToken: page.nextSyncToken };
				else throw new GoogleApiError(200, `The last page of ${calendarId} has no sync token`);
			}
		},
		patchEvent: async (calendarId, eventId, body) => parseEvent((await request('PATCH', `${BASE_URL}/${path('calendars', calendarId, 'events', eventId)}`, body)).json),
	};
};
