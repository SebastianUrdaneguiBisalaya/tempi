import type { CalendarEvent } from '../domain/event';
import type { GoogleCalendarLink, GoogleEventLink } from '../domain/google-sync';

/** Bookkeeping that ties local calendars and events to their Google counterparts. Never synced itself. */
export type GoogleSyncRepository = {
	/** Every Google calendar the last sync listed, selected or not. */
	listCalendars(): Promise<GoogleCalendarLink[]>;
	/** Inserts or replaces a calendar link by `googleId`. */
	saveCalendar(link: GoogleCalendarLink): Promise<void>;
	/** Forgets a Google calendar and the links of its events. */
	deleteCalendar(googleId: string): Promise<void>;
	/** Forgets the links of a Google calendar's events, e.g. when it stops syncing. */
	deleteEventLinks(googleCalendarId: string): Promise<void>;
	findEventLink(eventId: string): Promise<GoogleEventLink | null>;
	findEventLinkByGoogleId(googleCalendarId: string, googleEventId: string): Promise<GoogleEventLink | null>;
	/** Links of every event synced with a Google calendar. */
	listEventLinks(googleCalendarId: string): Promise<GoogleEventLink[]>;
	/** Inserts or replaces an event link by `eventId`. */
	saveEventLink(link: GoogleEventLink): Promise<void>;
	deleteEventLink(eventId: string): Promise<void>;
	/**
	 * Events with changes to push: linked ones whose `updatedAt` moved past their last sync (deleted ones included, and
	 * ones moved to another calendar), and live unlinked ones in any of `calendarIds`. Series and single events come
	 * before edited occurrences, so a series is on Google before its exceptions.
	 */
	listPendingEvents(calendarIds: string[]): Promise<CalendarEvent[]>;
	/** Forgets every Google calendar and event link (disconnecting). */
	clear(): Promise<void>;
};
