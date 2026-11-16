import { type DateRange, dateRangeSchema } from '../domain/date-range';
import { type EventOccurrence, MAX_REMINDER_MINUTES } from '../domain/event';
import { ok, parseWith, type Result } from '../domain/result';
import { instantToUtc } from '../domain/values';
import type { CoreDeps } from './deps';
import { listEvents } from './list-events';

/** An occurrence's reminder: when to notify (`reminderMinutes` before its start) and what about. */
export type Reminder = { fireAt: string; occurrence: EventOccurrence };

/**
 * Reminders that fire within the range (start inclusive, end exclusive), ordered by when they fire. Single events,
 * edited occurrences and every occurrence of a series get one when they set `reminderMinutes`. Events of hidden
 * calendars stay quiet, like everywhere else they are out of sight.
 */
export const listReminders = async (deps: Pick<CoreDeps, 'calendars' | 'events'>, range: DateRange): Promise<Result<Reminder[]>> => {
	const parsed = parseWith(dateRangeSchema, range);
	if (!parsed.ok) return parsed;

	// A reminder in the range belongs to an occurrence starting at most MAX_REMINDER_MINUTES after the range ends.
	const until = instantToUtc(Temporal.Instant.from(parsed.value.end).add({ minutes: MAX_REMINDER_MINUTES }));
	const listed = await listEvents(deps, { end: until, start: parsed.value.start });
	if (!listed.ok) return listed;

	const hidden = new Set((await deps.calendars.list()).filter(calendar => !calendar.isVisible).map(calendar => calendar.id));
	const reminders = listed.value.flatMap((occurrence): Reminder[] => {
		if (occurrence.reminderMinutes === null || hidden.has(occurrence.calendarId)) return [];
		const fireAt = instantToUtc(Temporal.Instant.from(occurrence.startAt).subtract({ minutes: occurrence.reminderMinutes }));
		return fireAt >= parsed.value.start && fireAt < parsed.value.end ? [{ fireAt, occurrence }] : [];
	});
	return ok(reminders.sort((a, b) => a.fireAt.localeCompare(b.fireAt) || a.occurrence.key.localeCompare(b.occurrence.key)));
};
