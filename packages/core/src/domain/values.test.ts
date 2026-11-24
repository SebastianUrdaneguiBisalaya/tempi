import { describe, expect, test } from 'bun:test';
import { isSameRange } from './values';

const stored = { endAt: '2026-11-24T16:00:00.000Z', startAt: '2026-11-24T15:00:00.000Z' };

describe('isSameRange', () => {
	test('matches the same instants written without milliseconds', () => {
		expect(isSameRange({ endAt: '2026-11-24T16:00:00Z', startAt: '2026-11-24T15:00:00Z' }, stored)).toBe(true);
	});

	test('matches the same instants written with another offset', () => {
		expect(isSameRange({ endAt: '2026-11-24T11:00:00-05:00', startAt: '2026-11-24T10:00-05:00' }, stored)).toBe(true);
	});

	test('tells a moved start or end apart', () => {
		expect(isSameRange({ endAt: '2026-11-24T16:00:00Z', startAt: '2026-11-24T15:15:00Z' }, stored)).toBe(false);
		expect(isSameRange({ endAt: '2026-11-24T16:30:00Z', startAt: '2026-11-24T15:00:00Z' }, stored)).toBe(false);
	});

	test('never matches an invalid instant', () => {
		expect(isSameRange({ endAt: 'nope', startAt: 'nope' }, { endAt: 'nope', startAt: 'nope' })).toBe(false);
	});
});
