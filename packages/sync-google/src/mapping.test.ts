import { describe, expect, test } from 'bun:test';
import { NO_SERIES } from '@tempi/core';
import { fromGoogle, googleEventIdFor, instanceId, toGoogle } from './mapping';

const base = { end: { dateTime: '2026-11-20T10:00:00-05:00' }, etag: '"1"', id: 'a', start: { dateTime: '2026-11-20T09:00:00-05:00' }, status: 'confirmed' };

describe('fromGoogle', () => {
	test('reads EXDATEs in UTC, in a TZID and as dates', () => {
		const fields = fromGoogle(
			{ ...base, recurrence: ['RRULE:FREQ=DAILY', 'EXDATE:20261121T140000Z', 'EXDATE;TZID=Europe/Madrid:20261122T150000,20261123T150000', 'EXDATE;VALUE=DATE:20261124'] },
			'America/Lima'
		);
		expect(fields?.exDates).toEqual(['2026-11-21T14:00:00.000Z', '2026-11-22T14:00:00.000Z', '2026-11-23T14:00:00.000Z', '2026-11-24T05:00:00.000Z']);
		expect(fields?.rrule).toBe('RRULE:FREQ=DAILY');
	});

	test('maps Google defaults Tempi has no notion of', () => {
		expect(fromGoogle({ ...base, reminders: { useDefault: true } }, 'UTC')).toMatchObject({ reminderMinutes: null, title: '—' });
		expect(fromGoogle({ ...base, hangoutLink: 'https://meet.google.com/abc', summary: 'Call' }, 'UTC')).toMatchObject({ title: 'Call', videoUrl: 'https://meet.google.com/abc' });
		expect(fromGoogle({ ...base, reminders: { overrides: [{ method: 'popup', minutes: 40_320 }], useDefault: false } }, 'UTC')?.reminderMinutes).toBeNull();
	});

	test('leaves out statuses that are not events, and events without times', () => {
		expect(fromGoogle({ ...base, eventType: 'workingLocation' }, 'UTC')).toBeNull();
		expect(fromGoogle({ etag: '"1"', id: 'a' }, 'UTC')).toBeNull();
	});
});

describe('ids', () => {
	test('instance ids use the original start in UTC, or the date for all-day events', () => {
		expect(instanceId('abc', '2026-11-27T14:00:00.000Z', false, 'America/Lima')).toBe('abc_20261127T140000Z');
		expect(instanceId('abc', '2026-11-27T05:00:00.000Z', true, 'America/Lima')).toBe('abc_20261127');
	});

	test('local UUIDs become valid Google ids', () => {
		expect(googleEventIdFor('01890A5D-AC96-774B-BCCE-B302099A8057')).toBe('01890a5dac96774bbcceb302099a8057');
		expect(googleEventIdFor('x-y')).toBeUndefined();
	});
});

describe('toGoogle', () => {
	const event = {
		...NO_SERIES,
		allDay: false,
		calendarId: 'c',
		createdAt: '2026-11-16T10:00:00.000Z',
		deletedAt: null,
		description: null,
		endAt: '2026-11-20T15:00:00.000Z',
		id: 'e',
		location: null,
		reminderMinutes: null,
		rrule: null,
		startAt: '2026-11-20T14:00:00.000Z',
		status: 'confirmed' as const,
		timeZone: 'America/Lima',
		title: 'Standup',
		updatedAt: '2026-11-16T10:00:00.000Z',
		videoUrl: null,
	};

	test('a single event clears any recurrence; an edited occurrence sends none', () => {
		expect(toGoogle(event, []).recurrence).toEqual([]);
		expect(toGoogle({ ...event, originalStartAt: event.startAt, recurringEventId: 's' }, []).recurrence).toBeUndefined();
	});

	test('a series sends its rule and skipped dates in order', () => {
		expect(toGoogle({ ...event, rrule: 'FREQ=WEEKLY' }, ['2026-12-04T14:00:00.000Z', '2026-11-27T14:00:00.000Z']).recurrence).toEqual([
			'RRULE:FREQ=WEEKLY',
			'EXDATE:20261127T140000Z',
			'EXDATE:20261204T140000Z',
		]);
	});
});
