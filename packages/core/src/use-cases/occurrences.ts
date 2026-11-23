import type { z } from 'zod';
import { type CalendarEvent, type EventOccurrence, type EventPatch, eventFieldsSchema, eventPatchSchema, NO_SERIES, type OccurrenceTarget, occurrenceTargetSchema } from '../domain/event';
import { isOccurrenceStart, splitRrule } from '../domain/recurrence';
import { fail, ok, parseWith, type Result } from '../domain/result';
import { instantToUtc } from '../domain/values';
import { type CoreDeps, nowIso } from './deps';
import { allowsGoogleMeet, writableCalendar } from './writable-calendar';

type Series = CalendarEvent & { rrule: string };
type Changes = z.output<typeof eventPatchSchema>;

const isSeries = (event: CalendarEvent): event is Series => event.rrule !== null;

const zoned = (instant: string, timeZone: string) => Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);

const durationOf = (event: Pick<CalendarEvent, 'endAt' | 'startAt'>) => Temporal.Instant.from(event.startAt).until(Temporal.Instant.from(event.endAt));

/** The fields a use case may change: everything but the id and the bookkeeping. */
const fieldsOf = ({ createdAt: _createdAt, deletedAt: _deletedAt, id: _id, updatedAt: _updatedAt, ...fields }: CalendarEvent) => fields;

/** A stored event as views list it. */
export const toOccurrence = (event: CalendarEvent): EventOccurrence => ({
	...event,
	key: event.id,
	series: event.recurringEventId === null || event.originalStartAt === null ? null : { id: event.recurringEventId, originalStartAt: event.originalStartAt },
});

/** A saved event as views list it: a new or edited series shows as its first occurrence. */
export const asOccurrence = (event: CalendarEvent): EventOccurrence => (event.rrule === null ? toOccurrence(event) : seriesOccurrence(event, event.startAt));

/** The occurrence of a series that starts at `startAt`: the series' fields with that occurrence's times. */
export const seriesOccurrence = (series: CalendarEvent, startAt: string): EventOccurrence => ({
	...series,
	endAt: instantToUtc(Temporal.Instant.from(startAt).add(durationOf(series))),
	key: `${series.id}:${startAt}`,
	series: { id: series.id, originalStartAt: startAt },
	startAt,
});

const notFound = (target: { originalStartAt: string; seriesId: string }) =>
	fail<never>('not_found', 'event.notFound', { detail: `Occurrence ${target.originalStartAt} of series ${target.seriesId} not found`, field: 'id' });

/** The series and its edited occurrences, if `originalStartAt` is one of its occurrences. */
const loadSeries = async (deps: Pick<CoreDeps, 'events'>, target: { originalStartAt: string; seriesId: string }): Promise<Result<{ overrides: CalendarEvent[]; series: Series }>> => {
	const series = await deps.events.findById(target.seriesId);
	if (series === null || series.deletedAt !== null || !isSeries(series) || !isOccurrenceStart(series, target.originalStartAt)) return notFound(target);
	return ok({ overrides: await deps.events.listBySeries(series.id), series });
};

/** The series' calendar and, when the edit moves it, the target must both allow changes, and the target the Meet. */
const calendarsWritable = async (deps: Pick<CoreDeps, 'calendars'>, calendarId: string | undefined, current: string, googleMeet: boolean): Promise<Result<null>> => {
	const source = await writableCalendar(deps, current);
	if (!source.ok) return source;
	const target = calendarId === undefined || calendarId === current ? source : await writableCalendar(deps, calendarId);
	return target.ok ? allowsGoogleMeet(target.value, googleMeet) : target;
};

/** Fields that don't move an occurrence in time; changing only these keeps the edited occurrences. */
const DETAIL_FIELDS = ['calendarId', 'description', 'googleMeet', 'location', 'reminderMinutes', 'status', 'title', 'videoUrl'] as const;

/**
 * Applies an edit made on one occurrence (shown at `shown`) to a whole series. Times move by the same wall-clock
 * shift as that occurrence, so every occurrence keeps its day. When the times or the rule change, edited
 * occurrences no longer line up and are dropped; otherwise they keep their own times and take the new details.
 */
const applyToSeries = (series: Series, overrides: CalendarEvent[], shown: Pick<CalendarEvent, 'endAt' | 'startAt'>, originalStartAt: string, changes: Changes, now: string) => {
	const startAt = changes.startAt ?? shown.startAt;
	const endAt = changes.endAt ?? shown.endAt;
	const shift = zoned(shown.startAt, series.timeZone).until(zoned(startAt, series.timeZone), { largestUnit: 'days' });
	const moved = (instant: string) => instantToUtc(zoned(instant, series.timeZone).add(shift).toInstant());
	const duration = Temporal.Instant.from(startAt).until(Temporal.Instant.from(endAt));
	const seriesStart = moved(series.startAt);
	const rrule = changes.rrule !== undefined ? changes.rrule : series.rrule;

	const retimed =
		shift.sign !== 0 ||
		Temporal.Duration.compare(duration, durationOf(series)) !== 0 ||
		rrule !== series.rrule ||
		(changes.timeZone ?? series.timeZone) !== series.timeZone ||
		(changes.allDay ?? series.allDay) !== series.allDay;
	const editedStarts = new Set(overrides.map(override => override.originalStartAt));
	const exDates = rrule === null ? [] : retimed ? series.exDates.filter(date => !editedStarts.has(date)).map(moved) : series.exDates;

	const fields = parseWith(eventFieldsSchema, {
		...fieldsOf(series),
		...changes,
		endAt: instantToUtc(Temporal.Instant.from(seriesStart).add(duration)),
		exDates,
		originalStartAt: null,
		recurringEventId: null,
		rrule,
		startAt: seriesStart,
	});
	if (!fields.ok) return fields;

	const details = Object.fromEntries(DETAIL_FIELDS.filter(key => changes[key] !== undefined && changes[key] !== series[key]).map(key => [key, changes[key]]));
	const savedOverrides = overrides.map(override => (retimed || rrule === null ? { ...override, deletedAt: now, updatedAt: now } : { ...override, ...details, updatedAt: now }));
	const saved: CalendarEvent = { ...fields.value, createdAt: series.createdAt, deletedAt: null, id: series.id, updatedAt: now };
	const occurrence = rrule === null ? toOccurrence(saved) : seriesOccurrence(saved, moved(originalStartAt));
	return ok({ occurrence, overrides: savedOverrides, series: saved });
};

/**
 * Edits one occurrence of a recurring event (`this`), it and the ones after it (`following`: the series ends
 * before it and a new series starts there), or the whole series (`all`). Returns the edited occurrence.
 * A `this` edit can't change the recurrence: the occurrence stays part of its series.
 */
export const updateOccurrence = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'ids'>, target: OccurrenceTarget, patch: EventPatch): Promise<Result<EventOccurrence>> => {
	const parsedTarget = parseWith(occurrenceTargetSchema, target);
	if (!parsedTarget.ok) return parsedTarget;
	const changes = parseWith(eventPatchSchema, patch);
	if (!changes.ok) return changes;
	const loaded = await loadSeries(deps, parsedTarget.value);
	if (!loaded.ok) return loaded;

	const { overrides, series } = loaded.value;
	const { originalStartAt, scope } = parsedTarget.value;
	const edited = overrides.find(override => override.originalStartAt === originalStartAt);
	const googleMeet = changes.value.googleMeet ?? (scope === 'this' && edited !== undefined ? edited : series).googleMeet;
	const calendar = await calendarsWritable(deps, changes.value.calendarId, series.calendarId, googleMeet);
	if (!calendar.ok) return calendar;

	const now = nowIso(deps.clock);
	const shown = edited ?? seriesOccurrence(series, originalStartAt);

	if (scope === 'this') {
		const base =
			edited === undefined ? { ...fieldsOf(series), endAt: shown.endAt, exDates: [], icalUid: null, originalStartAt, recurringEventId: series.id, startAt: originalStartAt } : fieldsOf(edited);
		const fields = parseWith(eventFieldsSchema, { ...base, ...changes.value, rrule: null });
		if (!fields.ok) return fields;
		const occurrence: CalendarEvent = { ...fields.value, createdAt: edited?.createdAt ?? now, deletedAt: null, id: edited?.id ?? deps.ids.next(), updatedAt: now };
		await deps.events.save(occurrence);
		// The series skips the start this occurrence replaces.
		if (edited === undefined) await deps.events.save({ ...series, exDates: [...series.exDates, originalStartAt].sort(), updatedAt: now });
		return ok(toOccurrence(occurrence));
	}

	if (scope === 'all' || originalStartAt === series.startAt) {
		const applied = applyToSeries(series, overrides, shown, originalStartAt, changes.value, now);
		if (!applied.ok) return applied;
		await deps.events.save(applied.value.series);
		for (const override of applied.value.overrides) await deps.events.save(override);
		return ok(applied.value.occurrence);
	}

	const { head, tail } = splitRrule(series, originalStartAt);
	const tailId = deps.ids.next();
	const tailSeries: Series = {
		...series,
		...NO_SERIES,
		createdAt: now,
		endAt: seriesOccurrence(series, originalStartAt).endAt,
		exDates: series.exDates.filter(date => date >= originalStartAt),
		id: tailId,
		rrule: tail,
		startAt: originalStartAt,
		// A new series is a new Google event, which gets its own Meet.
		videoUrl: series.googleMeet ? null : series.videoUrl,
	};
	const tailOverrides = overrides.filter(override => override.originalStartAt !== null && override.originalStartAt >= originalStartAt).map(override => ({ ...override, recurringEventId: tailId }));
	const applied = applyToSeries(tailSeries, tailOverrides, shown, originalStartAt, changes.value, now);
	if (!applied.ok) return applied;

	await deps.events.save({ ...series, exDates: series.exDates.filter(date => date < originalStartAt), rrule: head, updatedAt: now });
	await deps.events.save(applied.value.series);
	for (const override of applied.value.overrides) await deps.events.save(override);
	return ok(applied.value.occurrence);
};

/** Deletes one occurrence of a recurring event, it and the ones after it, or the whole series. */
export const deleteOccurrence = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events'>, target: OccurrenceTarget): Promise<Result<null>> => {
	const parsedTarget = parseWith(occurrenceTargetSchema, target);
	if (!parsedTarget.ok) return parsedTarget;
	const loaded = await loadSeries(deps, parsedTarget.value);
	if (!loaded.ok) return loaded;

	const { overrides, series } = loaded.value;
	const { originalStartAt, scope } = parsedTarget.value;
	const calendar = await writableCalendar(deps, series.calendarId);
	if (!calendar.ok) return calendar;
	const now = nowIso(deps.clock);
	const remove = (event: CalendarEvent) => deps.events.save({ ...event, deletedAt: now, updatedAt: now });

	if (scope === 'this') {
		const edited = overrides.find(override => override.originalStartAt === originalStartAt);
		if (edited !== undefined) await remove(edited);
		if (!series.exDates.includes(originalStartAt)) await deps.events.save({ ...series, exDates: [...series.exDates, originalStartAt].sort(), updatedAt: now });
		return ok(null);
	}

	if (scope === 'all' || originalStartAt === series.startAt) {
		await remove(series);
		for (const override of overrides) await remove(override);
		return ok(null);
	}

	await deps.events.save({ ...series, exDates: series.exDates.filter(date => date < originalStartAt), rrule: splitRrule(series, originalStartAt).head, updatedAt: now });
	for (const override of overrides) {
		if (override.originalStartAt !== null && override.originalStartAt >= originalStartAt) await remove(override);
	}
	return ok(null);
};
