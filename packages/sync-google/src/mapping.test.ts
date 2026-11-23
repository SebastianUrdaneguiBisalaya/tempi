import { describe, expect, test } from 'bun:test';
import { NO_SERIES } from '@tempi/core';
import { fromGoogle, googleEventIdFor, hasMeet, instanceId, NOT_ON_GOOGLE, toGoogle } from './mapping';

const MEET = { ...NOT_ON_GOOGLE, meet: true };

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

	test("a Google Meet turns the switch on and is the video link, over Tempi's own", () => {
		const meet = { conferenceData: { conferenceSolution: { key: { type: 'hangoutsMeet' } }, entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/abc' }] } };
		const own = { extendedProperties: { private: { tempiVideoUrl: 'https://old.example/x' } } };
		expect(fromGoogle({ ...base, ...meet, ...own }, 'UTC')).toMatchObject({ googleMeet: true, videoUrl: 'https://meet.google.com/abc' });
		expect(fromGoogle({ ...base, ...own }, 'UTC')).toMatchObject({ googleMeet: false, videoUrl: 'https://old.example/x' });
	});

	test('a Meet still being created has no link yet', () => {
		const pending = { conferenceData: { createRequest: { conferenceSolutionKey: { type: 'hangoutsMeet' }, requestId: 'r', status: { statusCode: 'pending' as const } } } };
		expect(fromGoogle({ ...base, ...pending }, 'UTC')).toMatchObject({ googleMeet: true, videoUrl: null });
	});

	test('guests are the invited people, in lower case, without the user, the organizer or rooms', () => {
		const attendees = [
			{ email: 'me@example.com', organizer: true, self: true },
			{ email: 'room@resource.calendar.google.com', resource: true },
			{ email: 'Grace@Example.com' },
			{ email: 'grace@example.com' },
			{ displayName: 'No email' },
		];
		expect(fromGoogle({ ...base, attendees, organizer: { email: 'me@example.com', self: true } }, 'UTC')).toMatchObject({ guests: ['grace@example.com'], guestsReadOnly: false });
	});

	test("guests of someone else's event are read-only unless its organizer lets guests change it", () => {
		const theirs = { ...base, organizer: { email: 'boss@example.com' } };
		expect(fromGoogle(theirs, 'UTC')?.guestsReadOnly).toBe(true);
		expect(fromGoogle({ ...theirs, guestsCanModify: true }, 'UTC')?.guestsReadOnly).toBe(false);
		expect(fromGoogle(base, 'UTC')?.guestsReadOnly).toBe(false);
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
		googleMeet: false,
		guests: [],
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
		expect(toGoogle(event, [], NOT_ON_GOOGLE).recurrence).toEqual([]);
		expect(toGoogle({ ...event, originalStartAt: event.startAt, recurringEventId: 's' }, [], NOT_ON_GOOGLE).recurrence).toBeUndefined();
	});

	test('a series sends its rule and skipped dates in order', () => {
		expect(toGoogle({ ...event, rrule: 'FREQ=WEEKLY' }, ['2026-12-04T14:00:00.000Z', '2026-11-27T14:00:00.000Z'], NOT_ON_GOOGLE).recurrence).toEqual([
			'RRULE:FREQ=WEEKLY',
			'EXDATE:20261127T140000Z',
			'EXDATE:20261204T140000Z',
		]);
	});

	test('asks for a Meet only when Google has none, and removes it only when Google has one', () => {
		const withMeet = { ...event, googleMeet: true };
		expect(toGoogle(withMeet, [], NOT_ON_GOOGLE).conferenceData).toEqual({ createRequest: { conferenceSolutionKey: { type: 'hangoutsMeet' }, requestId: 'e-2026-11-16T10:00:00.000Z' } });
		expect(toGoogle(withMeet, [], MEET)).not.toHaveProperty('conferenceData');
		expect(toGoogle(event, [], MEET).conferenceData).toBeNull();
		expect(toGoogle(event, [], NOT_ON_GOOGLE)).not.toHaveProperty('conferenceData');
	});

	test("with a Meet, Tempi's own video link is not sent", () => {
		expect(toGoogle({ ...event, googleMeet: true, videoUrl: 'https://meet.google.com/abc' }, [], MEET).extendedProperties?.private).toEqual({ tempiVideoUrl: '' });
		expect(toGoogle({ ...event, videoUrl: 'https://zoom.us/j/1' }, [], NOT_ON_GOOGLE).extendedProperties?.private).toEqual({ tempiVideoUrl: 'https://zoom.us/j/1' });
	});
});

describe('hasMeet', () => {
	test('is a Meet or a pending Meet request, never an add-on or a failed request', () => {
		expect(hasMeet({ conferenceData: { conferenceSolution: { key: { type: 'hangoutsMeet' } } } })).toBe(true);
		expect(hasMeet({ conferenceData: { createRequest: { conferenceSolutionKey: { type: 'hangoutsMeet' }, requestId: 'r', status: { statusCode: 'pending' } } } })).toBe(true);
		expect(hasMeet({ conferenceData: { createRequest: { conferenceSolutionKey: { type: 'hangoutsMeet' }, requestId: 'r', status: { statusCode: 'failure' } } } })).toBe(false);
		expect(hasMeet({ conferenceData: { conferenceSolution: { key: { type: 'addOn' } } } })).toBe(false);
		expect(hasMeet({})).toBe(false);
	});
});

describe('toGoogle guests', () => {
	const event = {
		...NO_SERIES,
		allDay: false,
		calendarId: 'c',
		createdAt: '2026-11-16T10:00:00.000Z',
		deletedAt: null,
		description: null,
		endAt: '2026-11-20T15:00:00.000Z',
		googleMeet: false,
		guests: ['grace@example.com'],
		id: 'e',
		location: null,
		reminderMinutes: null,
		rrule: null,
		startAt: '2026-11-20T14:00:00.000Z',
		status: 'confirmed' as const,
		timeZone: 'America/Lima',
		title: 'Planning',
		updatedAt: '2026-11-16T10:00:00.000Z',
		videoUrl: null,
	};
	const me = { email: 'me@example.com', organizer: true, self: true };

	test('sends the list only when the guests changed', () => {
		expect(toGoogle(event, [], NOT_ON_GOOGLE).attendees).toEqual([{ email: 'grace@example.com' }]);
		expect(toGoogle(event, [], { ...NOT_ON_GOOGLE, attendees: [me, { email: 'Grace@example.com' }] })).not.toHaveProperty('attendees');
		expect(toGoogle({ ...event, guests: [] }, [], NOT_ON_GOOGLE)).not.toHaveProperty('attendees');
	});

	test("keeps the attendees Tempi doesn't show and the details of guests still invited", () => {
		const remote = [me, { email: 'room@resource.calendar.google.com', resource: true }, { displayName: 'Grace', email: 'grace@example.com', optional: true }, { email: 'alan@example.com' }];
		expect(toGoogle(event, [], { ...NOT_ON_GOOGLE, attendees: remote }).attendees).toEqual([
			{ email: 'me@example.com' },
			{ email: 'room@resource.calendar.google.com' },
			{ displayName: 'Grace', email: 'grace@example.com', optional: true },
		]);
	});
});
