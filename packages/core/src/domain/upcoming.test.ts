import { describe, expect, test } from 'bun:test';
import { upcomingEvent } from './upcoming';

const NOW = Temporal.Instant.from('2026-11-16T15:00:00Z');
const NONE = new Set<string>();

const timed = (id: string, startAt: string, endAt: string, calendarId = 'work') => ({ allDay: false, calendarId, endAt, id, startAt });

describe('upcomingEvent', () => {
	test('picks the event that starts first after now', () => {
		const events = [timed('later', '2026-11-16T18:00:00Z', '2026-11-16T19:00:00Z'), timed('sooner', '2026-11-16T16:00:00Z', '2026-11-16T17:00:00Z')];
		expect(upcomingEvent(events, NOW, NONE)?.id).toBe('sooner');
	});

	test('keeps an event in progress until it ends, then switches to the next one', () => {
		const events = [timed('current', '2026-11-16T14:30:00Z', '2026-11-16T15:30:00Z'), timed('next', '2026-11-16T16:00:00Z', '2026-11-16T17:00:00Z')];
		expect(upcomingEvent(events, NOW, NONE)?.id).toBe('current');
		expect(upcomingEvent(events, Temporal.Instant.from('2026-11-16T15:30:00Z'), NONE)?.id).toBe('next');
	});

	test('ignores events that already ended', () => {
		expect(upcomingEvent([timed('past', '2026-11-16T13:00:00Z', '2026-11-16T15:00:00Z')], NOW, NONE)).toBeNull();
	});

	test('ignores events of hidden calendars', () => {
		const events = [timed('hidden', '2026-11-16T16:00:00Z', '2026-11-16T17:00:00Z', 'private'), timed('shown', '2026-11-16T18:00:00Z', '2026-11-16T19:00:00Z')];
		expect(upcomingEvent(events, NOW, new Set(['private']))?.id).toBe('shown');
	});

	test('ignores all-day events', () => {
		const events = [{ ...timed('all-day', '2026-11-16T05:00:00Z', '2026-11-17T05:00:00Z'), allDay: true }];
		expect(upcomingEvent(events, NOW, NONE)).toBeNull();
	});

	test('looks only seven days ahead', () => {
		expect(upcomingEvent([timed('inside', '2026-11-23T14:59:00Z', '2026-11-23T16:00:00Z')], NOW, NONE)?.id).toBe('inside');
		expect(upcomingEvent([timed('outside', '2026-11-23T15:00:00Z', '2026-11-23T16:00:00Z')], NOW, NONE)).toBeNull();
	});

	test('breaks a tie on start with the earlier end', () => {
		const events = [timed('long', '2026-11-16T16:00:00Z', '2026-11-16T18:00:00Z'), timed('short', '2026-11-16T16:00:00Z', '2026-11-16T16:30:00Z')];
		expect(upcomingEvent(events, NOW, NONE)?.id).toBe('short');
	});
});
