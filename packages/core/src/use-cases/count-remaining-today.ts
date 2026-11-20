import { type RemainingToday, remainingToday, todayRange } from '../domain/remaining-today';
import { ok, type Result } from '../domain/result';
import type { CoreDeps } from './deps';
import { listEvents } from './list-events';

/** Today's events still left at `now` in `timeZone` (the app icon badge), and when to count again. */
export const countRemainingToday = async (deps: Pick<CoreDeps, 'calendars' | 'events'>, now: Temporal.Instant, timeZone: string): Promise<Result<RemainingToday>> => {
	const listed = await listEvents(deps, todayRange(now, timeZone));
	if (!listed.ok) return listed;
	const hidden = new Set((await deps.calendars.list()).filter(calendar => !calendar.isVisible).map(calendar => calendar.id));
	return ok(remainingToday(listed.value, now, timeZone, hidden));
};
