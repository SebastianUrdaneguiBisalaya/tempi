import { fail, type Holiday, type HolidayProvider, holidaySchema, ok, type Result } from '@tempi/core';
import { type FetchLike, isMeshlyError } from '@usemeshly/auth';
import { type CommunityHoliday, createNagerDateClient } from '@usemeshly/nager-date';
import { z } from 'zod';

const holidaysSchema = z.array(holidaySchema);

/** Nager.Date's failures as the `holidays.*` keys the UI translates; the library's message (no URL) is the detail. */
const failure = (error: unknown): Result<never> => {
	const detail = error instanceof Error ? error.message : String(error);
	if (isMeshlyError(error, 'rate_limited')) return fail('internal', 'holidays.rateLimited', { detail });
	if (isMeshlyError(error, 'network_error', 'timeout')) return fail('internal', 'holidays.offline', { detail });
	return fail('internal', 'holidays.unavailable', { detail });
};

/**
 * Only days off for the whole country: regional holidays (with subdivision codes) and observances, school or bank
 * days don't apply to everyone in it.
 */
const isNationwidePublic = (holiday: CommunityHoliday): boolean =>
	holiday.holidayTypes.includes('Public') && (holiday.subdivisionCodes === null || holiday.subdivisionCodes === undefined || holiday.subdivisionCodes.length === 0);

/**
 * The holiday port over Nager.Date's free Community API, which needs no key. Requests go through `fetch` (the main
 * process's network stack); the renderer never reaches Nager.Date.
 */
export const createNagerDateHolidays = (fetch: FetchLike): HolidayProvider => {
	const nager = createNagerDateClient({ fetch, plan: 'community' });
	return {
		list: async (country, year) => {
			let answer: CommunityHoliday[];
			try {
				answer = await nager.holidays.list(country, year);
			} catch (error) {
				// A country Nager.Date doesn't cover has no holidays to add; failing would retry it on every launch.
				if (isMeshlyError(error, 'not_found')) return ok([]);
				return failure(error);
			}
			const holidays = holidaysSchema.safeParse(answer.filter(isNationwidePublic).map((holiday): Holiday => ({ date: holiday.date, name: holiday.name })));
			if (holidays.success) return ok(holidays.data);
			return fail('internal', 'holidays.unavailable', { detail: `Nager.Date sent unusable holidays: ${holidays.error.message}` });
		},
	};
};
