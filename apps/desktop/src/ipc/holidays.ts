import { type CoreDeps, type HolidayProvider, type HolidayYear, holidaysToFetch, ok, syncHolidays } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handleRequest } from './handle';

/**
 * `holidays:sync`. What to fetch is read in one transaction, Nager.Date is asked outside it (a slow answer never holds
 * the database queue), and the answer is applied in another, which reads storage again. A failed fetch writes nothing,
 * so the next sync asks again. `onChanged` runs once events were added or removed.
 */
export const registerHolidayHandlers = (context: HandlerContext, deps: CoreDeps, provider: HolidayProvider, onChanged?: () => void): void => {
	handleRequest(context, CHANNELS.holidays.sync, async () => {
		const plan = await context.transaction(async () => ok(await holidaysToFetch(deps)));
		if (!plan.ok) return plan;
		const fetched: HolidayYear[] = [];
		if (plan.value !== null) {
			const { country, years } = plan.value;
			for (const year of years) {
				const holidays = await provider.list(country, year);
				if (!holidays.ok) return holidays;
				fetched.push({ country, holidays: holidays.value, year });
			}
		}
		const result = await context.transaction(() => syncHolidays(deps, fetched));
		if (result.ok && result.value.created + result.value.removed > 0) onChanged?.();
		return result;
	});
};
