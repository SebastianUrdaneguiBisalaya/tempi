import type { DateRange } from '../domain/date-range';
import type { CalendarEvent } from '../domain/event';

export type EventRepository = {
	/** Returns the event even if soft-deleted, or null if it never existed. */
	findById(id: string): Promise<CalendarEvent | null>;
	/** Non-deleted events without a recurrence (single events and edited occurrences) whose [startAt, endAt) overlaps the range. */
	listInRange(range: DateRange): Promise<CalendarEvent[]>;
	/** Non-deleted edited occurrences of a series. */
	listBySeries(seriesId: string): Promise<CalendarEvent[]>;
	/** Non-deleted recurring series that start before `before`; expanding them tells which occur in a range. */
	listSeries(before: string): Promise<CalendarEvent[]>;
	/** Inserts or replaces the event by id. */
	save(event: CalendarEvent): Promise<void>;
	/** Soft-deletes every non-deleted event of a calendar, stamping `deletedAt` and `updatedAt`. */
	softDeleteByCalendar(calendarId: string, deletedAt: string): Promise<void>;
	/** Moves every non-deleted event of a calendar to another one, stamping `updatedAt`. */
	moveToCalendar(fromCalendarId: string, toCalendarId: string, updatedAt: string): Promise<void>;
};
