import type { CoreDeps } from './deps';

/** Clears `isDefault` on every calendar except `keepId`, so exactly one stays default. */
export const unsetOtherDefaults = async (deps: Pick<CoreDeps, 'calendars'>, keepId: string, now: string): Promise<void> => {
	const calendars = await deps.calendars.list();
	for (const calendar of calendars) {
		if (calendar.id !== keepId && calendar.isDefault) {
			await deps.calendars.save({ ...calendar, isDefault: false, updatedAt: now });
		}
	}
};
