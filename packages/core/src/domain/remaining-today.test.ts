import { describe, expect, test } from 'bun:test';
import { remainingToday, todayRange } from './remaining-today';

const LIMA = 'America/Lima';
const at = (iso: string) => Temporal.Instant.from(iso);
const event = (startAt: string, endAt: string, calendarId = 'cal-1') => ({ calendarId, endAt, startAt });
const none = new Set<string>();

describe('todayRange', () => {
	test('runs from local midnight to the next one', () => {
		expect(todayRange(at('2026-11-20T04:30:00Z'), LIMA)).toEqual({ end: '2026-11-20T05:00:00.000Z', start: '2026-11-19T05:00:00.000Z' });
	});

	test('is 23 hours on the day clocks spring forward', () => {
		const { end, start } = todayRange(at('2026-03-08T12:00:00Z'), 'America/New_York');
		expect(Date.parse(end) - Date.parse(start)).toBe(23 * 60 * 60_000);
	});
});

describe('remainingToday', () => {
	// 10:00 in Lima.
	const now = at('2026-11-20T15:00:00Z');

	test('counts events in progress and still to start today, all-day ones included, and not ended ones', () => {
		const occurrences = [
			event('2026-11-20T13:00:00Z', '2026-11-20T14:00:00Z'), // ended at 9:00
			event('2026-11-20T14:30:00Z', '2026-11-20T15:30:00Z'), // in progress
			event('2026-11-20T20:00:00Z', '2026-11-20T21:00:00Z'), // this afternoon
			event('2026-11-20T05:00:00Z', '2026-11-21T05:00:00Z'), // all day today
			event('2026-11-21T06:00:00Z', '2026-11-21T07:00:00Z'), // tomorrow, 1:00
		];
		expect(remainingToday(occurrences, now, LIMA, none)).toEqual({ count: 3, nextChangeAt: '2026-11-20T15:30:00.000Z' });
	});

	test('counts an event that started yesterday and is still going on', () => {
		expect(remainingToday([event('2026-11-19T20:00:00Z', '2026-11-20T16:00:00Z')], now, LIMA, none)).toEqual({ count: 1, nextChangeAt: '2026-11-20T16:00:00.000Z' });
	});

	test('changes next at local midnight when nothing ends before it', () => {
		expect(remainingToday([], now, LIMA, none)).toEqual({ count: 0, nextChangeAt: '2026-11-21T05:00:00.000Z' });
		expect(remainingToday([event('2026-11-20T23:00:00Z', '2026-11-21T08:00:00Z')], now, LIMA, none)).toEqual({ count: 1, nextChangeAt: '2026-11-21T05:00:00.000Z' });
	});

	test('skips events of hidden calendars', () => {
		const occurrences = [event('2026-11-20T20:00:00Z', '2026-11-20T21:00:00Z', 'hidden'), event('2026-11-20T22:00:00Z', '2026-11-20T23:00:00Z')];
		expect(remainingToday(occurrences, now, LIMA, new Set(['hidden']))).toEqual({ count: 1, nextChangeAt: '2026-11-20T23:00:00.000Z' });
	});

	test('drops an event the moment it ends', () => {
		expect(remainingToday([event('2026-11-20T14:00:00Z', '2026-11-20T15:00:00Z')], now, LIMA, none).count).toBe(0);
	});
});
