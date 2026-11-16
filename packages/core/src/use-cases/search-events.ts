import type { EventOccurrence } from '../domain/event';
import { upcomingOccurrenceStart } from '../domain/recurrence';
import { ok, parseWith, type Result } from '../domain/result';
import { requiredTextSchema } from '../domain/values';
import { type CoreDeps, nowIso } from './deps';
import { seriesOccurrence, toOccurrence } from './occurrences';

/** What the user typed to find events. */
export const eventSearchQuerySchema = requiredTextSchema;

/** Most results a search returns; enough to scan, few enough to stay instant. */
export const SEARCH_LIMIT = 50;

/**
 * Events whose title, location or description match the text (word prefixes, ignoring case and accents). A series
 * shows as its occurrence in progress or next to come (its last once it ended). Upcoming results come first,
 * soonest first, then past ones, latest first.
 */
export const searchEvents = async (deps: Pick<CoreDeps, 'clock' | 'events'>, query: string): Promise<Result<EventOccurrence[]>> => {
	const parsed = parseWith(eventSearchQuerySchema, query);
	if (!parsed.ok) return parsed;

	const now = nowIso(deps.clock);
	const found = await deps.events.search(parsed.value, SEARCH_LIMIT);
	const occurrences = await Promise.all(
		found.map(async (event): Promise<EventOccurrence | null> => {
			if (event.rrule !== null) {
				const start = upcomingOccurrenceStart({ ...event, rrule: event.rrule }, now);
				return start === null ? null : seriesOccurrence(event, start);
			}
			if (event.recurringEventId === null) return toOccurrence(event);
			// An edited occurrence shows its series' recurrence, as in the calendar.
			const series = await deps.events.findById(event.recurringEventId);
			return { ...toOccurrence(event), rrule: series?.rrule ?? null };
		})
	);
	const listed = occurrences.filter(occurrence => occurrence !== null);
	const upcoming = listed.filter(occurrence => occurrence.endAt > now).sort((a, b) => a.startAt.localeCompare(b.startAt));
	const past = listed.filter(occurrence => occurrence.endAt <= now).sort((a, b) => b.startAt.localeCompare(a.startAt));
	return ok([...upcoming, ...past]);
};
