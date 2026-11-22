import { type HolidaySyncResult, type HolidayYear, holidaysByDate } from '../domain/holiday';
import { fail, ok, type Result } from '../domain/result';
import { instantToUtc } from '../domain/values';
import { createEvent } from './create-event';
import { type CoreDeps, nowIso } from './deps';
import { getSettings } from './get-settings';
import { writableCalendar } from './writable-calendar';

/** The years whose holidays the calendar holds: the current one and the next, in the profile's time zone. */
export const holidayYears = (now: Date, timeZone: string): number[] => {
	const year = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timeZone).year;
	return [year, year + 1];
};

/** What to ask the holiday provider for: the profile country's years not fetched yet. */
export type HolidayFetch = { country: string; years: number[] };

/**
 * Reads which years must be fetched; null when none must (the integration is off, there is no country, or every year
 * is stored). Only reads storage, so it runs inside a transaction while the provider is called outside it.
 */
export const holidaysToFetch = async (deps: Pick<CoreDeps, 'clock' | 'holidays' | 'profile' | 'settings'>): Promise<HolidayFetch | null> => {
	const settings = await getSettings(deps);
	const profile = await deps.profile.get();
	if (!settings.holidaysEnabled || profile === null) return null;
	const fetched = new Set((await deps.holidays.listFetchedYears()).filter(year => year.country === profile.country).map(year => year.year));
	const years = holidayYears(deps.clock.now(), profile.timeZone).filter(year => !fetched.has(year));
	return years.length === 0 ? null : { country: profile.country, years };
};

/**
 * Soft-deletes every event the integration created that still exists (sync sends the deletion to Google), then
 * forgets what it tracked, so turning it on again fetches every holiday anew. Answers how many events it deleted.
 */
export const removeHolidays = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'holidays'>): Promise<number> => {
	const now = nowIso(deps.clock);
	let removed = 0;
	for (const holiday of await deps.holidays.listHolidays()) {
		const event = await deps.events.findById(holiday.eventId);
		if (event === null || event.deletedAt !== null) continue;
		// Moved by the user to a read-only calendar: it only changes through that calendar's sync.
		if (!(await writableCalendar(deps, event.calendarId)).ok) continue;
		await deps.events.save({ ...event, deletedAt: now, updatedAt: now });
		removed += 1;
	}
	await deps.holidays.clear();
	return removed;
};

/** An all-day event spans the day from midnight to midnight in its zone, stored as UTC instants. */
const dayStart = (date: Temporal.PlainDate, timeZone: string): string => instantToUtc(date.toZonedDateTime(timeZone).toInstant());

/**
 * Brings the calendar in line with the integration: off, it removes the holidays it made; on, it removes another
 * country's holidays and adds the fetched ones as all-day events in the default calendar. A holiday already tracked
 * (even if the user deleted its event) is skipped, and a fetch answered for a country the profile no longer has is
 * ignored. Storage is read again here, since it may have changed while the provider answered.
 */
export const syncHolidays = async (
	deps: Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'holidays' | 'ids' | 'profile' | 'settings'>,
	fetched: readonly HolidayYear[]
): Promise<Result<HolidaySyncResult>> => {
	const settings = await getSettings(deps);
	const profile = await deps.profile.get();
	if (!settings.holidaysEnabled || profile === null) return ok({ created: 0, removed: await removeHolidays(deps) });

	const tracked = await deps.holidays.listHolidays();
	const years = await deps.holidays.listFetchedYears();
	const countryChanged = [...tracked, ...years].some(item => item.country !== profile.country);
	const removed = countryChanged ? await removeHolidays(deps) : 0;

	const answers = fetched.filter(year => year.country === profile.country);
	if (answers.length === 0) return ok({ created: 0, removed });
	const calendar = (await deps.calendars.list()).find(item => item.isDefault);
	if (calendar === undefined) return fail('not_found', 'calendar.notFound', { detail: 'There is no default calendar to add holidays to' });

	const known = new Set(countryChanged ? [] : tracked.map(holiday => holiday.date));
	const done = new Set(countryChanged ? [] : years.map(year => year.year));
	let created = 0;
	for (const answer of answers) {
		if (done.has(answer.year)) continue;
		for (const holiday of holidaysByDate(answer.holidays)) {
			if (known.has(holiday.date)) continue;
			const day = Temporal.PlainDate.from(holiday.date);
			const event = await createEvent(deps, {
				allDay: true,
				calendarId: calendar.id,
				description: null,
				endAt: dayStart(day.add({ days: 1 }), profile.timeZone),
				location: null,
				reminderMinutes: null,
				rrule: null,
				startAt: dayStart(day, profile.timeZone),
				timeZone: profile.timeZone,
				title: holiday.name,
				videoUrl: null,
			});
			if (!event.ok) return event;
			await deps.holidays.saveHoliday({ country: profile.country, createdAt: event.value.createdAt, date: holiday.date, eventId: event.value.id });
			known.add(holiday.date);
			created += 1;
		}
		await deps.holidays.saveFetchedYear({ country: profile.country, fetchedAt: nowIso(deps.clock), year: answer.year });
		done.add(answer.year);
	}
	return ok({ created, removed });
};
