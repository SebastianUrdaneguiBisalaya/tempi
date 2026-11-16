import { describe, expect, test } from 'bun:test';
import { moveRange, resizeRange, sweepRange, wallTime } from './reschedule';

const LIMA = 'America/Lima';
const NEW_YORK = 'America/New_York';
const day = Temporal.PlainDate.from('2026-03-10');

describe('wallTime', () => {
	test('places minutes on the wall clock and maps the end of the day to the next midnight', () => {
		expect(
			wallTime(day, 9 * 60 + 15, LIMA)
				.toInstant()
				.toString()
		).toBe('2026-03-10T14:15:00Z');
		expect(
			wallTime(day, 24 * 60, LIMA)
				.toInstant()
				.toString()
		).toBe('2026-03-11T05:00:00Z');
	});
});

describe('moveRange', () => {
	const range = { endAt: '2026-03-10T15:00:00Z', startAt: '2026-03-10T14:00:00Z' }; // 9:00–10:00 in Lima

	test('moves by minutes and days, keeping the duration, in UTC', () => {
		expect(moveRange(range, { days: 1, minutes: 30 }, LIMA)).toEqual({ endAt: '2026-03-11T15:30:00Z', startAt: '2026-03-11T14:30:00Z' });
	});

	test('snaps the start to 15 minutes', () => {
		expect(moveRange(range, { days: 0, minutes: 22 }, LIMA).startAt).toBe('2026-03-10T14:15:00Z');
		expect(moveRange({ endAt: '2026-03-10T15:07:00Z', startAt: '2026-03-10T14:07:00Z' }, { days: 0, minutes: 15 }, LIMA)).toEqual({
			endAt: '2026-03-10T15:15:00Z',
			startAt: '2026-03-10T14:15:00Z',
		});
	});

	test('keeps the wall-clock time when moving across a DST change', () => {
		// 2026-03-07 9:00 EST → 2026-03-09 9:00 EDT.
		const moved = moveRange({ endAt: '2026-03-07T15:00:00Z', startAt: '2026-03-07T14:00:00Z' }, { days: 2, minutes: 0 }, NEW_YORK);
		expect(moved).toEqual({ endAt: '2026-03-09T14:00:00Z', startAt: '2026-03-09T13:00:00Z' });
	});
});

describe('resizeRange', () => {
	const range = { endAt: '2026-03-10T15:00:00Z', startAt: '2026-03-10T14:00:00Z' };

	test('sets the end, snapped to 15 minutes, without moving the start', () => {
		expect(resizeRange(range, wallTime(day, 11 * 60 + 8, LIMA))).toEqual({ endAt: '2026-03-10T16:15:00Z', startAt: range.startAt });
	});

	test('keeps at least 15 minutes after the start', () => {
		expect(resizeRange(range, wallTime(day, 8 * 60, LIMA)).endAt).toBe('2026-03-10T14:15:00Z');
	});

	test('can end on a later day', () => {
		expect(resizeRange(range, wallTime(day.add({ days: 1 }), 60, LIMA)).endAt).toBe('2026-03-11T06:00:00Z');
	});
});

describe('sweepRange', () => {
	test('covers the swept minutes in whole 15-minute steps, in either direction', () => {
		const expected = { endAt: '2026-03-10T15:30:00Z', startAt: '2026-03-10T14:00:00Z' };
		expect(sweepRange(day, 9 * 60 + 5, 10 * 60 + 20, LIMA)).toEqual(expected);
		expect(sweepRange(day, 10 * 60 + 20, 9 * 60 + 5, LIMA)).toEqual(expected);
	});

	test('is at least 15 minutes long and stays inside the day', () => {
		expect(sweepRange(day, 9 * 60, 9 * 60, LIMA)).toEqual({ endAt: '2026-03-10T14:15:00Z', startAt: '2026-03-10T14:00:00Z' });
		expect(sweepRange(day, 24 * 60, 24 * 60, LIMA)).toEqual({ endAt: '2026-03-11T05:00:00Z', startAt: '2026-03-11T04:45:00Z' });
	});
});
