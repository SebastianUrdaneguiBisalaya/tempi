import { z } from 'zod';
import { profileInputSchema } from './user-profile';
import { idSchema, requiredTextSchema, utcInstantSchema } from './values';

const isPlainDate = (value: string): boolean => {
	try {
		Temporal.PlainDate.from(value);
		return true;
	} catch {
		return false;
	}
};

/** A calendar day, `YYYY-MM-DD`, with no time or zone. */
export const plainDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.invalid_format')
	.refine(isPlainDate, 'validation.invalid_format');

/** ISO 3166-1 alpha-2, the same rule as the profile's country. */
export const countryCodeSchema = profileInputSchema.shape.country;

/** One public holiday as a provider tells it: the day and its name. */
export const holidaySchema = z.object({ date: plainDateSchema, name: requiredTextSchema });

export type Holiday = z.output<typeof holidaySchema>;

/** The holidays a provider answered for one country and year. */
export type HolidayYear = { country: string; holidays: readonly Holiday[]; year: number };

/** What one holiday sync changed in the calendar. */
export const holidaySyncResultSchema = z.object({
	created: z.number().int().min(0),
	removed: z.number().int().min(0),
});

export type HolidaySyncResult = z.output<typeof holidaySyncResultSchema>;

/**
 * A holiday the integration turned into an event, by country and date. It stays after the user deletes the event, so
 * a later sync never creates it again.
 */
export const trackedHolidaySchema = z.object({ country: countryCodeSchema, createdAt: utcInstantSchema, date: plainDateSchema, eventId: idSchema });

export type TrackedHoliday = z.output<typeof trackedHolidaySchema>;

/** A year whose holidays were fetched for a country, so later launches don't ask again. */
export const fetchedHolidayYearSchema = z.object({
	country: countryCodeSchema,
	fetchedAt: utcInstantSchema,
	year: z.number().int('validation.integer').min(1, 'validation.min').max(9999, 'validation.max'),
});

export type FetchedHolidayYear = z.output<typeof fetchedHolidayYearSchema>;

/**
 * One holiday per date, in date order: holidays are tracked by date, so a day with two of them becomes one event
 * named after both.
 */
export const holidaysByDate = (holidays: readonly Holiday[]): Holiday[] => {
	const names = new Map<string, string[]>();
	for (const holiday of holidays) {
		const day = names.get(holiday.date) ?? [];
		if (!day.includes(holiday.name)) day.push(holiday.name);
		names.set(holiday.date, day);
	}
	return [...names].sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => ({ date, name: day.join(' / ') }));
};
