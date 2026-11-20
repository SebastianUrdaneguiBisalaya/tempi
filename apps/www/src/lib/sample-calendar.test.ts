import { describe, expect, test } from 'bun:test';
import { freeSlots, presetRange, weekStats } from './sample-calendar';

// A Wednesday: the English week runs Sunday (-3) to Saturday (3), the Spanish one Monday (-2) to Sunday (4).
const TODAY = new Date(2026, 10, 18);

describe('presetRange', () => {
	test('this week runs from today to the end of the week, next week is the whole week after', () => {
		expect(presetRange('thisWeek', TODAY, 0)).toEqual({ from: 0, to: 3 });
		expect(presetRange('thisWeek', TODAY, 1)).toEqual({ from: 0, to: 4 });
		expect(presetRange('nextWeek', TODAY, 1)).toEqual({ from: 5, to: 11 });
	});
});

describe('freeSlots', () => {
	test('lists working days only, from now on, without events or slots under 30 minutes', () => {
		expect(freeSlots(TODAY, { from: 0, to: 3 })).toEqual([
			// 12:35–13:00 is too short; lunch ended before now.
			{
				day: 0,
				slots: [
					{ start: 14, end: 15 },
					{ start: 16.5, end: 18 },
				],
			},
			{
				day: 1,
				slots: [
					{ start: 9.5, end: 10 },
					{ start: 11.5, end: 15.5 },
					{ start: 16.5, end: 18 },
				],
			},
			// The 8:00 gym ends as working hours start.
			{
				day: 2,
				slots: [
					{ start: 9, end: 11 },
					{ start: 12, end: 15 },
					{ start: 16, end: 18 },
				],
			},
		]);
	});

	test('past days have no free time left', () => {
		expect(freeSlots(TODAY, { from: -1, to: -1 })).toEqual([{ day: -1, slots: [] }]);
	});
});

describe('weekStats', () => {
	const stats = weekStats(TODAY, 0);

	test('totals the timed events of the week and compares them with the week before', () => {
		expect(stats.totals).toEqual({ minutes: 1170, events: 18, averageMinutes: 65 });
		// Only the weekday-anchored events fall in the week before: Sunday's walk and visit, Monday's planning and games.
		expect(stats.previous).toEqual({ minutes: 360, events: 4, averageMinutes: 90 });
		expect(stats.busiestDay).toEqual({ day: 0, minutes: 270 });
	});

	test('ranks calendars and events by time, ties by name', () => {
		expect(stats.byCalendar).toEqual([
			{ calendar: 'project', minutes: 450 },
			{ calendar: 'personal', minutes: 360 },
			{ calendar: 'work', minutes: 360 },
		]);
		expect(stats.top.map(item => [item.key, item.count, item.minutes])).toEqual([
			['gym', 2, 120],
			['research', 1, 120],
			['docs', 1, 90],
			['focus', 1, 90],
			['planning', 1, 90],
		]);
	});

	test('splits busy time into the hours it falls in', () => {
		// Wednesday is row 2; the 15:00–16:30 focus block.
		expect(stats.heatmap[2]?.[15]).toBe(60);
		expect(stats.heatmap[2]?.[16]).toBe(30);
	});

	test('counts venue, recurrence and status by event', () => {
		expect(stats.venue).toEqual({ virtual: 4, inPerson: 1, none: 13 });
		expect(stats.recurrence).toEqual({ recurring: 4, oneOff: 14 });
		expect(stats.status).toEqual({ confirmed: 18, tentative: 0 });
	});

	test('measures working hours booked and the free blocks of 2 hours or more in them', () => {
		expect(stats.working).toEqual({ minutes: 2700, busyMinutes: 840, focusMinutes: 1320 });
	});

	test('sums the next seven days from today, weekday-anchored events filling the days without relative ones', () => {
		expect(stats.nextWeek.map(day => day.minutes)).toEqual([270, 180, 180, 150, 210, 150, 0]);
	});
});
