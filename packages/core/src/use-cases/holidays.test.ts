import { describe, expect, test } from 'bun:test';
import { type Holiday, type HolidayYear, holidaysByDate } from '../domain/holiday';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { deleteEvent } from './delete-event';
import { holidaysToFetch, holidayYears, removeHolidays, syncHolidays } from './holidays';
import { failure, makeDeps } from './test-fakes';

const PE_2026: Holiday[] = [
	{ date: '2026-01-01', name: 'New Year’s Day' },
	{ date: '2026-07-28', name: 'Independence Day' },
];
const PE_2027: Holiday[] = [{ date: '2027-01-01', name: 'New Year’s Day' }];
const CL_2026: Holiday[] = [{ date: '2026-09-18', name: 'Independence Day' }];

const depsWith = async ({ country = 'PE', holidaysEnabled = true, profile = true } = {}) => {
	const deps = makeDeps();
	const now = deps.clock.now().toISOString();
	await deps.settings.save({ ...DEFAULT_SETTINGS, createdAt: now, holidaysEnabled, updatedAt: now });
	if (profile) await deps.profile.save({ avatar: null, country, createdAt: now, firstName: 'Ana', lastName: 'Quispe', timeZone: 'America/Lima', updatedAt: now });
	const calendar = await createCalendar(deps, { color: '#aabbcc', name: 'Personal' });
	if (!calendar.ok) throw new Error('could not create the default calendar');
	return { calendarId: calendar.value.id, deps };
};

type Deps = Awaited<ReturnType<typeof depsWith>>['deps'];

const setCountry = async (deps: Deps, country: string) => {
	const profile = await deps.profile.get();
	if (profile === null) throw new Error('no profile');
	await deps.profile.save({ ...profile, country });
};

const setEnabled = async (deps: Deps, holidaysEnabled: boolean) => {
	const settings = await deps.settings.get();
	if (settings === null) throw new Error('no settings');
	await deps.settings.save({ ...settings, holidaysEnabled });
};

const liveEvents = (deps: Deps) => [...deps.events.rows.values()].filter(event => event.deletedAt === null);

/** What a provider would answer for each year `holidaysToFetch` asks for. */
const answer = (country: string, years: number[], source: Record<number, Holiday[]>): HolidayYear[] => years.map(year => ({ country, holidays: source[year] ?? [], year }));

/** One launch: ask what to fetch, answer it, and sync. */
const launch = async (deps: Deps, source: Record<string, Record<number, Holiday[]>>) => {
	const plan = await holidaysToFetch(deps);
	const fetched = plan === null ? [] : answer(plan.country, plan.years, source[plan.country] ?? {});
	return { plan, result: await syncHolidays(deps, fetched) };
};

const SOURCE = { CL: { 2026: CL_2026 }, PE: { 2026: PE_2026, 2027: PE_2027 } };

describe('holidayYears', () => {
	test('is the current and next year in the profile time zone', () => {
		// Already 2027 in UTC, still 2026 in Lima.
		expect(holidayYears(new Date('2027-01-01T03:00:00.000Z'), 'America/Lima')).toEqual([2026, 2027]);
		expect(holidayYears(new Date('2027-01-01T03:00:00.000Z'), 'UTC')).toEqual([2027, 2028]);
	});
});

describe('holidaysByDate', () => {
	test('merges holidays that share a date into one, in date order', () => {
		expect(
			holidaysByDate([
				{ date: '2026-12-25', name: 'Christmas' },
				{ date: '2026-06-29', name: 'Saint Peter' },
				{ date: '2026-06-29', name: 'Saint Paul' },
				{ date: '2026-06-29', name: 'Saint Peter' },
			])
		).toEqual([
			{ date: '2026-06-29', name: 'Saint Peter / Saint Paul' },
			{ date: '2026-12-25', name: 'Christmas' },
		]);
	});
});

describe('syncHolidays', () => {
	test('the first launch fetches this year and the next and saves them as all-day events in the default calendar', async () => {
		const { calendarId, deps } = await depsWith();
		const { plan, result } = await launch(deps, SOURCE);
		expect(plan).toEqual({ country: 'PE', years: [2026, 2027] });
		expect(result).toEqual({ ok: true, value: { created: 3, removed: 0 } });
		const independence = liveEvents(deps).find(event => event.title === 'Independence Day');
		expect(independence).toMatchObject({
			allDay: true,
			calendarId,
			// Midnight to midnight in Lima (UTC-5).
			endAt: '2026-07-29T05:00:00.000Z',
			reminderMinutes: null,
			rrule: null,
			startAt: '2026-07-28T05:00:00.000Z',
			timeZone: 'America/Lima',
		});
	});

	test('later launches fetch nothing while the year and country stay the same', async () => {
		const { deps } = await depsWith();
		await launch(deps, SOURCE);
		expect(await holidaysToFetch(deps)).toBeNull();
		expect(await syncHolidays(deps, [])).toEqual({ ok: true, value: { created: 0, removed: 0 } });
		expect(liveEvents(deps)).toHaveLength(3);
	});

	test('a new year fetches only the missing year', async () => {
		const { deps } = await depsWith();
		await launch(deps, SOURCE);
		deps.clock.set('2027-03-01T12:00:00.000Z');
		const { plan, result } = await launch(deps, { PE: { 2028: [{ date: '2028-07-28', name: 'Independence Day' }] } });
		expect(plan).toEqual({ country: 'PE', years: [2028] });
		expect(result).toEqual({ ok: true, value: { created: 1, removed: 0 } });
		expect(liveEvents(deps)).toHaveLength(4);
	});

	test('a refetch of a year never duplicates its holidays', async () => {
		const { deps } = await depsWith();
		await launch(deps, SOURCE);
		expect(await syncHolidays(deps, answer('PE', [2026, 2027], SOURCE.PE))).toEqual({ ok: true, value: { created: 0, removed: 0 } });
		expect(liveEvents(deps)).toHaveLength(3);
	});

	test('a holiday whose event the user deleted is never created again', async () => {
		const { deps } = await depsWith();
		await launch(deps, SOURCE);
		const newYear = liveEvents(deps).find(event => event.startAt === '2026-01-01T05:00:00.000Z');
		if (newYear === undefined) throw new Error('missing holiday');
		await deleteEvent(deps, newYear.id);
		// Even if the year is asked again, e.g. the bookkeeping of the year was lost.
		deps.holidays.years.clear();
		expect(await launch(deps, SOURCE)).toMatchObject({ result: { ok: true, value: { created: 0, removed: 0 } } });
		expect(liveEvents(deps).map(event => event.startAt)).not.toContain('2026-01-01T05:00:00.000Z');
	});

	test('a country change deletes the previous country’s holidays and fetches the new one’s', async () => {
		const { deps } = await depsWith();
		await launch(deps, SOURCE);
		await setCountry(deps, 'CL');
		const { plan, result } = await launch(deps, SOURCE);
		expect(plan).toEqual({ country: 'CL', years: [2026, 2027] });
		expect(result).toEqual({ ok: true, value: { created: 1, removed: 3 } });
		expect(liveEvents(deps).map(event => event.startAt)).toEqual(['2026-09-18T05:00:00.000Z']);
		expect((await deps.holidays.listHolidays()).map(holiday => holiday.country)).toEqual(['CL']);
	});

	test('ignores an answer for a country the profile no longer has', async () => {
		const { deps } = await depsWith();
		const plan = await holidaysToFetch(deps);
		await setCountry(deps, 'CL');
		expect(await syncHolidays(deps, answer('PE', plan?.years ?? [], SOURCE.PE))).toEqual({ ok: true, value: { created: 0, removed: 0 } });
		expect(liveEvents(deps)).toHaveLength(0);
		expect(await holidaysToFetch(deps)).toEqual({ country: 'CL', years: [2026, 2027] });
	});

	test('with no profile (so no country), nothing is fetched', async () => {
		const { deps } = await depsWith({ profile: false });
		expect(await holidaysToFetch(deps)).toBeNull();
		expect(await syncHolidays(deps, [])).toEqual({ ok: true, value: { created: 0, removed: 0 } });
	});

	test('turning the switch off soft-deletes every holiday it created, and on fetches them again', async () => {
		const { deps } = await depsWith();
		await launch(deps, SOURCE);
		await setEnabled(deps, false);
		expect(await holidaysToFetch(deps)).toBeNull();
		expect(await syncHolidays(deps, [])).toEqual({ ok: true, value: { created: 0, removed: 3 } });
		expect(liveEvents(deps)).toHaveLength(0);
		// Soft-deleted, so the deletion reaches Google through sync.
		expect([...deps.events.rows.values()].every(event => event.deletedAt === '2026-11-15T10:00:00.000Z')).toBe(true);

		await setEnabled(deps, true);
		expect(await launch(deps, SOURCE)).toMatchObject({ plan: { country: 'PE', years: [2026, 2027] }, result: { ok: true, value: { created: 3, removed: 0 } } });
	});

	test('off, removing leaves events the user made untouched', async () => {
		const { calendarId, deps } = await depsWith();
		await launch(deps, SOURCE);
		const mine = await createEvent(deps, { calendarId, endAt: '2026-11-20T15:00:00.000Z', startAt: '2026-11-20T14:00:00.000Z', timeZone: 'America/Lima', title: 'Dentist' });
		if (!mine.ok) throw new Error('could not create the event');
		expect(await removeHolidays(deps)).toBe(3);
		expect(liveEvents(deps).map(event => event.id)).toEqual([mine.value.id]);
	});

	test('fails without a default calendar', async () => {
		const deps = makeDeps();
		const now = deps.clock.now().toISOString();
		await deps.profile.save({ avatar: null, country: 'PE', createdAt: now, firstName: 'Ana', lastName: 'Quispe', timeZone: 'America/Lima', updatedAt: now });
		expect(await syncHolidays(deps, answer('PE', [2026], SOURCE.PE))).toEqual(failure('not_found'));
	});
});
