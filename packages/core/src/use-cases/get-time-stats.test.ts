import { describe, expect, test } from 'bun:test';
import type { NewEventInput } from '../domain/event';
import type { TimeStats, TimeStatsQueryInput } from '../domain/time-stats';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { getTimeStats } from './get-time-stats';
import { saveSettings } from './save-settings';
import { makeDeps } from './test-fakes';
import { updateCalendar } from './update-calendar';

const LIMA = 'America/Lima';
// Monday 2026-11-23, 10:00 in Lima (UTC-5, no DST): the week reported is the one before.
const NOW = Temporal.Instant.from('2026-11-23T15:00:00Z');
const WEEK = { from: '2026-11-16', to: '2026-11-22' };

const setup = async () => {
	const deps = makeDeps();
	const work = await createCalendar(deps, { color: '#3366ff', name: 'Work' });
	const home = await createCalendar(deps, { color: '#22c55e', name: 'Home' });
	if (!work.ok || !home.ok) throw new Error('calendar setup failed');
	/** Creates an event from Lima wall-clock times; `end` may be on `endDate`. */
	const create = async (date: string, start: string, end: string, overrides: Partial<NewEventInput> & { endDate?: string } = {}) => {
		const { endDate = date, ...fields } = overrides;
		const at = (day: string, time: string) =>
			Temporal.PlainDate.from(day)
				.toZonedDateTime({ plainTime: Temporal.PlainTime.from(time), timeZone: LIMA })
				.toInstant()
				.toString();
		const created = await createEvent(deps, { calendarId: work.value.id, endAt: at(endDate, end), startAt: at(date, start), timeZone: LIMA, title: 'Busy', ...fields });
		if (!created.ok) throw new Error('event setup failed');
	};
	const stats = async (query: TimeStatsQueryInput = WEEK): Promise<TimeStats> => {
		const result = await getTimeStats(deps, query, NOW, LIMA);
		if (!result.ok) throw new Error(`stats failed: ${JSON.stringify(result.error)}`);
		return result.value;
	};
	return { create, deps, homeId: home.value.id, stats, workId: work.value.id };
};

describe('getTimeStats', () => {
	test('counts overlapping events once and gives each minute to the calendar of the event that started first', async () => {
		const { create, homeId, stats, workId } = await setup();
		await create('2026-11-17', '10:00', '11:00');
		await create('2026-11-17', '10:30', '11:30', { calendarId: homeId });
		const report = await stats();
		expect(report.totals).toEqual({ averageMinutes: 60, events: 2, minutes: 90 });
		expect(report.byCalendar).toEqual([
			{ calendarId: workId, minutes: 60 },
			{ calendarId: homeId, minutes: 30 },
		]);
		expect(report.busiestDay).toEqual({ date: '2026-11-17', minutes: 90 });
		// Tuesday is row 1; 10:00–11:00 is fully busy, 11:00–11:30 half.
		expect(report.heatmap[1]?.[10]).toBe(60);
		expect(report.heatmap[1]?.[11]).toBe(30);
		expect(report.weeks).toEqual([{ byCalendar: report.byCalendar, start: '2026-11-16' }]);
	});

	test('leaves out all-day events and hidden calendars, and clips events at the period edges', async () => {
		const { create, deps, homeId, stats } = await setup();
		await create('2026-11-18', '00:00', '00:00', { allDay: true, endDate: '2026-11-19', title: 'Holiday' });
		await create('2026-11-18', '09:00', '12:00', { calendarId: homeId });
		await updateCalendar(deps, homeId, { isVisible: false });
		await create('2026-11-15', '23:00', '01:00', { endDate: '2026-11-16', title: 'Late' });
		await create('2026-11-22', '23:30', '00:30', { endDate: '2026-11-23', title: 'Night' });
		const report = await stats();
		expect(report.totals).toEqual({ averageMinutes: 45, events: 2, minutes: 90 });
	});

	test('compares with the period of the same length just before', async () => {
		const { create, stats } = await setup();
		await create('2026-11-10', '09:00', '10:00');
		await create('2026-11-12', '09:00', '09:30');
		await create('2026-11-17', '09:00', '11:00');
		const report = await stats();
		expect(report.previous).toEqual({ averageMinutes: 45, events: 2, minutes: 90 });
		expect(report.totals.minutes).toBe(120);
	});

	test('splits occurrences by place, recurrence and status, and ranks series by their time', async () => {
		const { create, stats } = await setup();
		await create('2026-11-16', '09:00', '09:30', { rrule: 'FREQ=DAILY;COUNT=3', title: 'Standup', videoUrl: 'https://meet.example/abc' });
		await create('2026-11-17', '14:00', '15:00', { location: 'Office', status: 'tentative', title: 'Review' });
		await create('2026-11-18', '16:00', '16:20', { title: 'call mom' });
		await create('2026-11-19', '16:00', '16:20', { title: 'Call Mom ' });
		const report = await stats();
		expect(report.venue).toEqual({ inPerson: 1, none: 2, virtual: 3 });
		expect(report.recurrence).toEqual({ oneOff: 3, recurring: 3 });
		expect(report.status).toEqual({ confirmed: 5, tentative: 1 });
		expect(report.top).toEqual([
			{ count: 3, minutes: 90, title: 'Standup' },
			{ count: 1, minutes: 60, title: 'Review' },
			{ count: 2, minutes: 40, title: 'call mom' },
		]);
	});

	test('lists the next seven days from today', async () => {
		const { create, stats } = await setup();
		await create('2026-11-24', '09:00', '10:30');
		const report = await stats();
		expect(report.nextWeek.map(day => day.date)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
		expect(report.nextWeek[1]).toEqual({ date: '2026-11-24', minutes: 90 });
	});

	test('reports occupancy and focus time only while working hours are on', async () => {
		const { create, deps, stats } = await setup();
		await create('2026-11-16', '09:00', '13:00');
		await create('2026-11-16', '17:00', '19:00');
		expect((await stats()).working).toBeNull();

		await saveSettings(deps, { workingHours: { days: [1, 2, 3, 4, 5], enabled: true, end: '18:00', start: '09:00' } });
		// Five 9-hour days; Monday has 5 busy hours inside them and 13:00–17:00 free, the other days are free all day.
		expect((await stats()).working).toEqual({ busyMinutes: 300, focusMinutes: 240 + 4 * 540, minutes: 2700 });
	});

	test.each([
		[{ from: '2026-11-22', to: '2026-11-16' }, 'range.endBeforeStart'],
		[{ from: '2026-01-01', to: '2026-06-30' }, 'range.tooLong'],
		[{ from: '2026-11-31', to: '2026-12-01' }, 'validation.invalid_format'],
	] satisfies [TimeStatsQueryInput, string][])('rejects %p', async (query, key) => {
		const { deps } = await setup();
		const result = await getTimeStats(deps, query, NOW, LIMA);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.issues).toContainEqual(expect.objectContaining({ key }));
	});
});
