import type { Calendar } from '../domain/calendar';

export type CalendarRepository = {
	/** Returns the calendar even if soft-deleted, or null if it never existed. */
	findById(id: string): Promise<Calendar | null>;
	/** Non-deleted calendars. */
	list(): Promise<Calendar[]>;
	/** Inserts or replaces the calendar by id. */
	save(calendar: Calendar): Promise<void>;
};
