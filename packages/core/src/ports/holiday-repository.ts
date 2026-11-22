import type { FetchedHolidayYear, TrackedHoliday } from '../domain/holiday';

/** What the holidays integration remembers: the holidays it made into events and the years it already fetched. */
export type HolidayRepository = {
	/** Every tracked holiday, whether or not its event still exists. */
	listHolidays(): Promise<TrackedHoliday[]>;
	listFetchedYears(): Promise<FetchedHolidayYear[]>;
	/** Inserts or replaces the holiday by country and date. */
	saveHoliday(holiday: TrackedHoliday): Promise<void>;
	/** Inserts or replaces the year by country and year. */
	saveFetchedYear(year: FetchedHolidayYear): Promise<void>;
	/** Forgets every tracked holiday and fetched year, so the next sync starts over. Events are left as they are. */
	clear(): Promise<void>;
};
