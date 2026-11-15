import type { DateRange } from '../domain/date-range';
import type { CalendarEvent } from '../domain/event';

export type EventRepository = {
	/** Returns the event even if soft-deleted, or null if it never existed. */
	findById(id: string): Promise<CalendarEvent | null>;
	/** Non-deleted events whose [startAt, endAt) overlaps the range. Recurrences are not expanded. */
	listInRange(range: DateRange): Promise<CalendarEvent[]>;
	/** Inserts or replaces the event by id. */
	save(event: CalendarEvent): Promise<void>;
	/** Soft-deletes every non-deleted event of a calendar, stamping `deletedAt` and `updatedAt`. */
	softDeleteByCalendar(calendarId: string, deletedAt: string): Promise<void>;
};
