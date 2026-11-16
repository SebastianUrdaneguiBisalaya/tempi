import type { CalendarEvent } from '../domain/event';
import { newEventInputSchema } from '../domain/event';
import { type ImportEventsInput, type ImportSummary, importEventsInputSchema } from '../domain/ical-transfer';
import { fail, ok, parseWith, type Result } from '../domain/result';
import { toUtcInstant } from '../domain/values';
import { type CoreDeps, nowIso } from './deps';

/**
 * Adds the events of an iCalendar file to a calendar, all in the caller's one transaction. An event whose UID is
 * already in the calendar is updated in place (keeping its id) and its edited occurrences are replaced by the file's,
 * so importing the same file again changes nothing. Events and exceptions that break Tempi's rules are left out and
 * counted as skipped; the rest still import.
 */
export const importEvents = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'ids'>, input: ImportEventsInput): Promise<Result<ImportSummary>> => {
	const parsed = parseWith(importEventsInputSchema, input);
	if (!parsed.ok) return parsed;
	const { calendarId, events } = parsed.value;

	const calendar = await deps.calendars.findById(calendarId);
	if (calendar === null || calendar.deletedAt !== null) return fail('not_found', 'calendar.notFound', { detail: `Calendar ${calendarId} not found`, field: 'calendarId' });

	const now = nowIso(deps.clock);
	const stamps = { createdAt: now, deletedAt: null, updatedAt: now };
	const summary: ImportSummary = { created: 0, skipped: 0, updated: 0 };

	for (const imported of events) {
		const fields = newEventInputSchema.safeParse({ ...imported.fields, calendarId });
		if (!fields.success) {
			summary.skipped += 1 + imported.overrides.length;
			continue;
		}
		const isSeries = fields.data.rrule !== null;
		const overrides = isSeries
			? imported.overrides.flatMap(override => {
					const originalStartAt = toUtcInstant(override.originalStartAt);
					const overrideFields = newEventInputSchema.safeParse({ ...override.fields, calendarId, rrule: null });
					return originalStartAt !== null && overrideFields.success ? [{ fields: overrideFields.data, originalStartAt }] : [];
				})
			: [];
		summary.skipped += imported.overrides.length - overrides.length;
		// A series skips its edited occurrences' original starts too, like one edited in Tempi.
		const exDates = isSeries ? [...new Set([...imported.exDates.flatMap(date => toUtcInstant(date) ?? []), ...overrides.map(override => override.originalStartAt)])].sort() : [];

		const existing = imported.uid === null ? null : await deps.events.findByUid(calendarId, imported.uid);
		const series: CalendarEvent = {
			...fields.data,
			...stamps,
			exDates,
			icalUid: existing === null ? imported.uid : existing.icalUid,
			id: existing?.id ?? deps.ids.next(),
			originalStartAt: null,
			recurringEventId: null,
			...(existing === null ? {} : { createdAt: existing.createdAt }),
		};
		if (existing !== null) {
			for (const edited of await deps.events.listBySeries(existing.id)) await deps.events.save({ ...edited, deletedAt: now, updatedAt: now });
		}
		await deps.events.save(series);
		for (const override of overrides) {
			await deps.events.save({ ...override.fields, ...stamps, exDates: [], icalUid: null, id: deps.ids.next(), originalStartAt: override.originalStartAt, recurringEventId: series.id });
		}
		if (existing === null) summary.created += 1;
		else summary.updated += 1;
	}
	return ok(summary);
};
