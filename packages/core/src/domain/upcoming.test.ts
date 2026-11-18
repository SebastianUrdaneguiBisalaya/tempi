import { describe, expect, test } from 'bun:test';
import { upcomingEvents } from './upcoming';

const NOW = Temporal.Instant.from('2026-11-16T15:00:00Z');
const NONE = new Set<string>();

const timed = (id: string, startAt: string, endAt: string, calendarId = 'work') => ({ allDay: false, calendarId, endAt, id, startAt });
const ids = (events: readonly { id: string }[]) => events.map(event => event.id);

describe('upcomingEvents', () => {
	test('lists every event ahead, the soonest first', () => {
		const events = [timed('later', '2026-11-16T18:00:00Z', '2026-11-16T19:00:00Z'), timed('sooner', '2026-11-16T16:00:00Z', '2026-11-16T17:00:00Z')];
		expect(ids(upcomingEvents(events, NOW, NONE))).toEqual(['sooner', 'later']);
	});

	test('keeps an event in progress first until it ends', () => {
		const events = [timed('next', '2026-11-16T16:00:00Z', '2026-11-16T17:00:00Z'), timed('current', '2026-11-16T14:30:00Z', '2026-11-16T15:30:00Z')];
		expect(ids(upcomingEvents(events, NOW, NONE))).toEqual(['current', 'next']);
		expect(ids(upcomingEvents(events, Temporal.Instant.from('2026-11-16T15:30:00Z'), NONE))).toEqual(['next']);
	});

	test('ignores events that already ended', () => {
		expect(upcomingEvents([timed('past', '2026-11-16T13:00:00Z', '2026-11-16T15:00:00Z')], NOW, NONE)).toEqual([]);
	});

	test('ignores events of hidden calendars', () => {
		const events = [timed('hidden', '2026-11-16T16:00:00Z', '2026-11-16T17:00:00Z', 'private'), timed('shown', '2026-11-16T18:00:00Z', '2026-11-16T19:00:00Z')];
		expect(ids(upcomingEvents(events, NOW, new Set(['private'])))).toEqual(['shown']);
	});

	test('ignores all-day events', () => {
		const events = [{ ...timed('all-day', '2026-11-16T05:00:00Z', '2026-11-17T05:00:00Z'), allDay: true }];
		expect(upcomingEvents(events, NOW, NONE)).toEqual([]);
	});

	test('looks only 24 hours ahead', () => {
		const events = [timed('inside', '2026-11-17T14:59:00Z', '2026-11-17T16:00:00Z'), timed('outside', '2026-11-17T15:00:00Z', '2026-11-17T16:00:00Z')];
		expect(ids(upcomingEvents(events, NOW, NONE))).toEqual(['inside']);
	});

	test('breaks a tie on start with the earlier end', () => {
		const events = [timed('long', '2026-11-16T16:00:00Z', '2026-11-16T18:00:00Z'), timed('short', '2026-11-16T16:00:00Z', '2026-11-16T16:30:00Z')];
		expect(ids(upcomingEvents(events, NOW, NONE))).toEqual(['short', 'long']);
	});
});
