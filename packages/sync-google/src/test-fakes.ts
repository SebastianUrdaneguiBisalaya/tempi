import { GoogleApiError, type GoogleCalendarApi, type GoogleCalendarListEntry, type GoogleEvent, type GoogleEventBody, GoogleOfflineError, SyncTokenExpiredError } from '@tempi/google-calendar';

type Stored = GoogleEvent & { version: number };

/**
 * An in-memory Google Calendar for tests, with the behavior sync relies on: versioned changes behind sync tokens
 * (deleted events included), instance ids for occurrences of a series, client-chosen ids with 409 on reuse, and
 * a switch to go offline.
 */
export class FakeGoogle implements GoogleCalendarApi {
	calendars: GoogleCalendarListEntry[] = [];
	readonly events = new Map<string, Map<string, Stored>>();
	offline = false;
	/** Sync tokens issued before this version have expired (410). */
	expiredBefore = 0;
	private version = 0;
	private clock = Date.parse('2026-11-16T09:00:00.000Z');

	addCalendar(entry: GoogleCalendarListEntry): void {
		this.calendars.push(entry);
		this.events.set(entry.id, new Map());
	}

	/** Adds or edits an event as if someone changed it on Google, a minute after the last change. */
	put(calendarId: string, event: Omit<GoogleEvent, 'etag' | 'updated'>): GoogleEvent {
		const stored = this.store(calendarId, event);
		return stored;
	}

	get(calendarId: string, id: string): Stored | undefined {
		return this.events.get(calendarId)?.get(id);
	}

	/** Live events of a calendar, by id. */
	live(calendarId: string): Stored[] {
		return [...(this.events.get(calendarId)?.values() ?? [])].filter(event => event.status !== 'cancelled').sort((a, b) => a.id.localeCompare(b.id));
	}

	private calendar(calendarId: string) {
		const events = this.events.get(calendarId);
		if (events === undefined) throw new GoogleApiError(404, `No calendar ${calendarId}`);
		return events;
	}

	private store(calendarId: string, event: Omit<GoogleEvent, 'etag' | 'updated'>): Stored {
		this.version += 1;
		this.clock += 60_000;
		const stored: Stored = { ...event, etag: `"${this.version}"`, updated: new Date(this.clock).toISOString(), version: this.version };
		this.calendar(calendarId).set(event.id, stored);
		return stored;
	}

	private online(): void {
		if (this.offline) throw new GoogleOfflineError('offline');
	}

	/** Instance ids are `<series id>_<original start>`; an occurrence edited for the first time becomes an exception. */
	private instance(calendarId: string, id: string): Stored | null {
		const separator = id.lastIndexOf('_');
		if (separator < 0) return null;
		const series = this.calendar(calendarId).get(id.slice(0, separator));
		if (series === undefined || series.recurrence === undefined) return null;
		const stamp = id.slice(separator + 1);
		const originalStartTime = stamp.includes('T')
			? { dateTime: stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'), timeZone: series.start?.timeZone }
			: { date: stamp.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') };
		return { ...series, etag: '"0"', id, originalStartTime, recurrence: undefined, recurringEventId: series.id, version: 0 };
	}

	listCalendars(): Promise<GoogleCalendarListEntry[]> {
		this.online();
		return Promise.resolve(this.calendars);
	}

	listEvents(calendarId: string, syncToken: string | null): Promise<{ items: GoogleEvent[]; nextSyncToken: string }> {
		this.online();
		const since = syncToken === null ? 0 : Number(syncToken);
		if (syncToken !== null && since < this.expiredBefore) return Promise.reject(new SyncTokenExpiredError('410'));
		const items = [...this.calendar(calendarId).values()]
			.filter(event => event.version > since && (syncToken !== null || event.status !== 'cancelled' || event.recurringEventId !== undefined))
			.map(({ version: _version, ...event }) => event);
		return Promise.resolve({ items, nextSyncToken: String(this.version) });
	}

	getEvent(calendarId: string, eventId: string): Promise<GoogleEvent | null> {
		this.online();
		const current = this.calendar(calendarId).get(eventId) ?? this.instance(calendarId, eventId);
		if (current === null) return Promise.resolve(null);
		const { version: _version, ...event } = current;
		return Promise.resolve(event);
	}

	insertEvent(calendarId: string, body: GoogleEventBody): Promise<GoogleEvent> {
		this.online();
		const id = body.id ?? `g${this.version + 1}`;
		if (this.calendar(calendarId).has(id)) return Promise.reject(new GoogleApiError(409, `${id} exists`));
		return Promise.resolve(this.store(calendarId, { ...body, id }));
	}

	patchEvent(calendarId: string, eventId: string, body: GoogleEventBody): Promise<GoogleEvent> {
		this.online();
		const current = this.calendar(calendarId).get(eventId) ?? this.instance(calendarId, eventId);
		if (current === null) return Promise.reject(new GoogleApiError(404, `${eventId} not found`));
		const { etag: _etag, updated: _updated, version: _version, ...rest } = current;
		return Promise.resolve(this.store(calendarId, { ...rest, ...body, id: eventId }));
	}

	deleteEvent(calendarId: string, eventId: string): Promise<void> {
		this.online();
		const current = this.calendar(calendarId).get(eventId) ?? this.instance(calendarId, eventId);
		if (current === null || current.status === 'cancelled') return Promise.resolve();
		const { etag: _etag, updated: _updated, version: _version, ...rest } = current;
		this.store(calendarId, { ...rest, status: 'cancelled' });
		return Promise.resolve();
	}
}
