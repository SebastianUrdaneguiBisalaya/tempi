import { type FreeSlots, type FreeSlotsQueryInput, freeSlots, freeSlotsQuerySchema, searchRange } from '../domain/free-slots';
import { ok, parseWith, type Result } from '../domain/result';
import type { CoreDeps } from './deps';
import { getSettings } from './get-settings';
import { listEvents } from './list-events';

/**
 * Free time in `timeZone` for the query's days: what is left of each day's window once timed events of the chosen
 * calendars (every visible one by default) are taken out. All-day events don't block time.
 */
export const findFreeSlots = async (
	deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'settings'>,
	input: FreeSlotsQueryInput,
	now: Temporal.Instant,
	timeZone: string
): Promise<Result<FreeSlots>> => {
	const parsed = parseWith(freeSlotsQuerySchema, input);
	if (!parsed.ok) return parsed;
	const query = parsed.value;
	const { workingHours } = await getSettings(deps);
	const range = searchRange(query, workingHours, timeZone);
	if (range === null) return ok(freeSlots([], query, workingHours, timeZone, now));

	const listed = await listEvents(deps, range);
	if (!listed.ok) return listed;
	const calendars = await deps.calendars.list();
	const counted = new Set(query.calendarIds === undefined ? calendars.filter(calendar => calendar.isVisible).map(calendar => calendar.id) : query.calendarIds);
	const busy = listed.value.filter(event => !event.allDay && counted.has(event.calendarId));
	return ok(freeSlots(busy, query, workingHours, timeZone, now));
};
