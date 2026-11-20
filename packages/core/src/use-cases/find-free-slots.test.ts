import { describe, expect, test } from 'bun:test';
import type { NewEventInput } from '../domain/event';
import type { FreeSlots, FreeSlotsQueryInput } from '../domain/free-slots';
import type { Result } from '../domain/result';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { findFreeSlots } from './find-free-slots';
import { saveSettings } from './save-settings';
import { makeDeps } from './test-fakes';
import { updateCalendar } from './update-calendar';

const LIMA = 'America/Lima';
// Monday 2026-11-16, 00:00 in Lima (UTC-5, no DST).
const MONDAY = Temporal.Instant.from('2026-11-16T05:00:00Z');

const setup = async () => {
	const deps = makeDeps();
	const work = await createCalendar(deps, { color: '#3366ff', name: 'Work' });
	const home = await createCalendar(deps, { color: '#22c55e', name: 'Home' });
	if (!work.ok || !home.ok) throw new Error('calendar setup failed');
	/** Creates an event from Lima wall-clock times on `date`. */
	const create = async (date: string, start: string, end: string, overrides: Partial<NewEventInput> = {}) => {
		const at = (time: string) =>
			Temporal.PlainDate.from(date)
				.toZonedDateTime({ plainTime: Temporal.PlainTime.from(time), timeZone: LIMA })
				.toInstant()
				.toString();
		const created = await createEvent(deps, { calendarId: work.value.id, endAt: at(end), startAt: at(start), timeZone: LIMA, title: 'Busy', ...overrides });
		if (!created.ok) throw new Error('event setup failed');
	};
	const find = (query: FreeSlotsQueryInput, now = MONDAY, timeZone = LIMA) => findFreeSlots(deps, query, now, timeZone);
	return { create, deps, find, homeId: home.value.id, workId: work.value.id };
};

/** The day's slots as Lima wall-clock `HH:MM–HH:MM`, for readable expectations. */
const local = (slots: readonly { endAt: string; startAt: string }[], timeZone = LIMA) =>
	slots.map(slot => {
		const time = (instant: string) => Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainTime().toString({ smallestUnit: 'minute' });
		return `${time(slot.startAt)}–${time(slot.endAt)}`;
	});

const slotsOf = async (search: Result<FreeSlots> | Promise<Result<FreeSlots>>, date: string) => {
	const result = await search;
	if (!result.ok) throw new Error(`search failed: ${JSON.stringify(result.error)}`);
	return local(result.value.days.find(day => day.date === date)?.slots ?? []);
};

describe('findFreeSlots', () => {
	test('takes merged events out of the default 09:00–18:00 window', async () => {
		const { create, find } = await setup();
		await create('2026-11-17', '10:00', '11:00');
		await create('2026-11-17', '10:30', '12:00');
		await create('2026-11-17', '12:00', '13:00');
		await create('2026-11-17', '15:00', '15:20');
		await create('2026-11-17', '17:45', '18:30');
		const result = await find({ from: '2026-11-17', to: '2026-11-17' });
		expect(await slotsOf(result, '2026-11-17')).toEqual(['09:00–10:00', '13:00–15:00', '15:20–17:45']);
	});

	test('drops slots shorter than the minimum', async () => {
		const { create, find } = await setup();
		await create('2026-11-17', '09:20', '17:30');
		expect(await slotsOf(await find({ from: '2026-11-17', to: '2026-11-17' }), '2026-11-17')).toEqual(['17:30–18:00']);
		expect(await slotsOf(await find({ from: '2026-11-17', minMinutes: 15, to: '2026-11-17' }), '2026-11-17')).toEqual(['09:00–09:20', '17:30–18:00']);
	});

	test('counts series occurrences, but not all-day events or hidden calendars', async () => {
		const { create, deps, find, homeId } = await setup();
		await create('2026-11-17', '09:00', '10:00', { rrule: 'FREQ=DAILY;COUNT=3', title: 'Standup' });
		await create('2026-11-18', '00:00', '00:00', { allDay: true, endAt: '2026-11-19T05:00:00Z', startAt: '2026-11-18T05:00:00Z', title: 'Holiday' });
		await create('2026-11-18', '14:00', '15:00', { calendarId: homeId });
		await updateCalendar(deps, homeId, { isVisible: false });
		expect(await slotsOf(await find({ from: '2026-11-18', to: '2026-11-18' }), '2026-11-18')).toEqual(['10:00–18:00']);
	});

	test('counts only the chosen calendars when given', async () => {
		const { create, find, homeId, workId } = await setup();
		await create('2026-11-17', '09:00', '12:00');
		await create('2026-11-17', '14:00', '18:00', { calendarId: homeId });
		expect(await slotsOf(await find({ calendarIds: [homeId], from: '2026-11-17', to: '2026-11-17' }), '2026-11-17')).toEqual(['09:00–14:00']);
		expect(await slotsOf(await find({ calendarIds: [workId], from: '2026-11-17', to: '2026-11-17' }), '2026-11-17')).toEqual(['12:00–18:00']);
	});

	test('starts today’s search at the current time', async () => {
		const { find } = await setup();
		const tuesdayAt1110 = Temporal.Instant.from('2026-11-17T16:10:00Z');
		const result = await find({ from: '2026-11-17', to: '2026-11-18' }, tuesdayAt1110);
		expect(await slotsOf(result, '2026-11-17')).toEqual(['11:10–18:00']);
		expect(await slotsOf(result, '2026-11-18')).toEqual(['09:00–18:00']);
	});

	test('searches the working days and hours when they are on, and the query’s own window over both', async () => {
		const { deps, find } = await setup();
		const week = { from: '2026-11-16', to: '2026-11-22' };
		const dates = async (query: FreeSlotsQueryInput) => {
			const result = await find(query);
			return result.ok ? result.value.days.map(day => day.date) : [];
		};
		expect(await dates(week)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);

		await saveSettings(deps, { workingHours: { days: [6, 7], enabled: true, end: '12:00', start: '08:00' } });
		expect(await dates(week)).toEqual(['2026-11-21', '2026-11-22']);
		expect(await slotsOf(await find(week), '2026-11-21')).toEqual(['08:00–12:00']);
		expect(await slotsOf(await find({ ...week, days: [6], windowEnd: '20:00', windowStart: '19:00' }), '2026-11-21')).toEqual(['19:00–20:00']);
	});

	test('reads the window in the zone’s local time across a DST change', async () => {
		const { find } = await setup();
		const newYork = 'America/New_York';
		// DST ends on Sunday 2026-11-01: 01:00–03:00 that night lasts three hours.
		const result = await find({ days: [7], from: '2026-11-01', to: '2026-11-01', windowEnd: '03:00', windowStart: '01:00' }, Temporal.Instant.from('2026-10-31T00:00:00Z'), newYork);
		if (!result.ok) throw new Error('search failed');
		expect(result.value.days[0]?.slots).toEqual([{ endAt: '2026-11-01T08:00:00.000Z', startAt: '2026-11-01T05:00:00.000Z' }]);
		expect(result.value.timeZone).toBe(newYork);
	});

	test.each([
		[{ from: '2026-11-18', to: '2026-11-17' }, 'range.endBeforeStart', 'to'],
		[{ from: '2026-11-01', to: '2026-12-15' }, 'availability.rangeTooLong', 'to'],
		[{ from: '2026-11-17', to: '2026-11-17', windowEnd: '09:00', windowStart: '10:00' }, 'range.endBeforeStart', 'windowEnd'],
		[{ from: '2026-11-17', minMinutes: 5, to: '2026-11-17' }, 'validation.min', 'minMinutes'],
		[{ from: '2026-02-30', to: '2026-03-01' }, 'validation.invalid_format', 'from'],
		[{ days: [], from: '2026-11-17', to: '2026-11-17' }, 'settings.workingDays', 'days'],
	] satisfies [FreeSlotsQueryInput, string, string][])('rejects %p', async (query, key, field) => {
		const { find } = await setup();
		const result = await find(query);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.issues).toContainEqual(expect.objectContaining({ field, key }));
	});

	test('reports the longest range a search may cover', async () => {
		const { find } = await setup();
		const result = await find({ from: '2026-11-01', to: '2026-12-15' });
		if (result.ok) throw new Error('expected a failure');
		expect(result.error.issues[0]?.params).toMatchObject({ maximum: 31 });
	});
});
