import { describe, expect, test } from 'bun:test';
import type { Calendar, CalendarEvent, ImportedEvent } from '@tempi/core';
import { parseIcs } from './parse';
import { serializeIcs } from './serialize';

const T0 = '2026-11-15T10:00:00.000Z';
const OPTIONS = { defaultDurationMinutes: 45, timeZone: 'America/Lima' };

const calendar: Calendar = { color: '#3b82f6', createdAt: T0, deletedAt: null, id: 'cal-1', isDefault: true, isVisible: true, name: 'Work', source: 'local', updatedAt: T0 };

const event = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
	allDay: false,
	calendarId: 'cal-1',
	createdAt: T0,
	deletedAt: null,
	description: null,
	endAt: '2026-11-20T15:00:00.000Z',
	exDates: [],
	icalUid: null,
	id: 'event-1',
	location: null,
	originalStartAt: null,
	recurringEventId: null,
	reminderMinutes: null,
	rrule: null,
	startAt: '2026-11-20T14:00:00.000Z',
	status: 'confirmed',
	timeZone: 'America/Lima',
	title: 'Standup',
	updatedAt: T0,
	videoUrl: null,
	...overrides,
});

const parsed = (text: string): ImportedEvent[] => {
	const result = parseIcs(text, OPTIONS);
	if (!result.ok) throw new Error(result.error.issues[0]?.detail);
	return result.value.events;
};

/** Normalizes instants as core's schemas would, to compare against stored events. */
const utc = (instant: unknown) => new Date(String(instant)).toISOString();

const ics = (...lines: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//EN', ...lines, 'END:VCALENDAR'].join('\r\n');

describe('serializeIcs → parseIcs', () => {
	test('reads back every field of a single event', () => {
		const original = event({
			description: 'Notes, with; special\ncharacters',
			icalUid: 'abc@google.com',
			location: 'Room 4',
			reminderMinutes: 10,
			status: 'tentative',
			videoUrl: 'https://meet.example/abc',
		});
		const [read] = parsed(serializeIcs({ calendars: [calendar], events: [original] }, new Date(T0)));

		expect(read?.uid).toBe('abc@google.com');
		const fields: Record<string, unknown> = { ...read?.fields, endAt: utc(read?.fields.endAt), startAt: utc(read?.fields.startAt) };
		expect(fields).toEqual({
			allDay: false,
			description: original.description,
			endAt: original.endAt,
			location: 'Room 4',
			reminderMinutes: 10,
			rrule: null,
			startAt: original.startAt,
			status: 'tentative',
			timeZone: 'America/Lima',
			title: 'Standup',
			videoUrl: 'https://meet.example/abc',
		});
	});

	test('uses the event id as UID for events made in Tempi', () => {
		expect(parsed(serializeIcs({ calendars: [calendar], events: [event({})] }, new Date(T0)))[0]?.uid).toBe('event-1');
	});

	test('keeps an all-day event on its days, in its own zone', () => {
		const original = event({ allDay: true, endAt: '2026-11-22T05:00:00.000Z', startAt: '2026-11-20T05:00:00.000Z', timeZone: 'America/Lima' });
		const [read] = parsed(serializeIcs({ calendars: [calendar], events: [original] }, new Date(T0)));
		expect([read?.fields.allDay, utc(read?.fields.startAt), utc(read?.fields.endAt), read?.fields.timeZone]).toEqual([true, original.startAt, original.endAt, 'America/Lima']);
	});

	test('keeps a series with skipped dates and edited occurrences', () => {
		const series = event({ exDates: ['2026-11-21T14:00:00.000Z', '2026-11-22T14:00:00.000Z'], icalUid: 'series@example.com', id: 'series', rrule: 'FREQ=DAILY;COUNT=5' });
		const edited = event({
			endAt: '2026-11-22T17:00:00.000Z',
			id: 'edited',
			originalStartAt: '2026-11-22T14:00:00.000Z',
			recurringEventId: 'series',
			startAt: '2026-11-22T16:00:00.000Z',
			title: 'Late standup',
		});
		const [read] = parsed(serializeIcs({ calendars: [calendar], events: [series, edited] }, new Date(T0)));

		expect(read?.uid).toBe('series@example.com');
		expect(String(read?.fields.rrule).replace(/^RRULE:/, '')).toBe('FREQ=DAILY;COUNT=5');
		// The edited start comes back as an override, not as a skipped date: import adds it to the series' exDates.
		expect(read?.exDates.map(utc)).toEqual(['2026-11-21T14:00:00.000Z']);
		expect(read?.overrides.map(override => [utc(override.originalStartAt), override.fields.title, utc(override.fields.startAt)])).toEqual([
			['2026-11-22T14:00:00.000Z', 'Late standup', '2026-11-22T16:00:00.000Z'],
		]);
	});

	test('names the calendar when exporting one', () => {
		expect(serializeIcs({ calendars: [calendar], events: [] }, new Date(T0))).toContain('X-WR-CALNAME:Work');
	});
});

describe('parseIcs', () => {
	test('rejects text that is not iCalendar', () => {
		expect(parseIcs('hello', OPTIONS)).toMatchObject({ error: { issues: [{ key: 'ical.invalidFile' }] }, ok: false });
		expect(parseIcs('BEGIN:VCARD\r\nVERSION:4.0\r\nEND:VCARD', OPTIONS)).toMatchObject({ ok: false });
	});

	test('reads UTC, IANA and floating times', () => {
		const events = parsed(
			ics(
				'BEGIN:VEVENT',
				'UID:utc',
				'DTSTART:20261120T140000Z',
				'DTEND:20261120T150000Z',
				'SUMMARY:UTC',
				'END:VEVENT',
				'BEGIN:VEVENT',
				'UID:tokyo',
				'DTSTART;TZID=Asia/Tokyo:20261120T090000',
				'DTEND;TZID=Asia/Tokyo:20261120T100000',
				'SUMMARY:Tokyo',
				'END:VEVENT',
				'BEGIN:VEVENT',
				'UID:floating',
				'DTSTART:20261120T090000',
				'SUMMARY:Floating',
				'END:VEVENT'
			)
		);
		expect(events.map(({ fields }) => [fields.title, utc(fields.startAt), utc(fields.endAt), fields.timeZone])).toEqual([
			['UTC', '2026-11-20T14:00:00.000Z', '2026-11-20T15:00:00.000Z', 'UTC'],
			['Tokyo', '2026-11-20T00:00:00.000Z', '2026-11-20T01:00:00.000Z', 'Asia/Tokyo'],
			// No end: the user's default duration, in the user's zone.
			['Floating', '2026-11-20T14:00:00.000Z', '2026-11-20T14:45:00.000Z', 'America/Lima'],
		]);
	});

	test('resolves a non-IANA TZID through the file VTIMEZONE (Outlook)', () => {
		const [read] = parsed(
			ics(
				'BEGIN:VTIMEZONE',
				'TZID:Pacific Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011104T020000',
				'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
				'TZOFFSETFROM:-0700',
				'TZOFFSETTO:-0800',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010311T020000',
				'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
				'TZOFFSETFROM:-0800',
				'TZOFFSETTO:-0700',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'UID:outlook',
				'DTSTART;TZID=Pacific Standard Time:20261120T090000',
				'DTEND;TZID=Pacific Standard Time:20261120T100000',
				'SUMMARY:Outlook',
				'END:VEVENT'
			)
		);
		expect([utc(read?.fields.startAt), read?.fields.timeZone]).toEqual(['2026-11-20T17:00:00.000Z', 'America/Lima']);
	});

	test('drops fields Tempi cannot use instead of the event', () => {
		const [read] = parsed(
			ics(
				'BEGIN:VEVENT',
				'UID:loose',
				'DTSTART:20261120T140000Z',
				'DTEND:20261120T150000Z',
				'SUMMARY:Loose',
				'URL:ftp://files.example/x',
				'BEGIN:VALARM',
				'ACTION:DISPLAY',
				'TRIGGER;RELATED=END:PT5M',
				'END:VALARM',
				'END:VEVENT'
			)
		);
		expect([read?.fields.videoUrl, read?.fields.reminderMinutes]).toEqual([null, null]);
	});

	test('leaves out cancelled events and turns cancelled occurrences into skipped dates', () => {
		const events = parsed(
			ics(
				'BEGIN:VEVENT',
				'UID:series',
				'DTSTART:20261120T140000Z',
				'DTEND:20261120T150000Z',
				'RRULE:FREQ=DAILY;COUNT=3',
				'SUMMARY:Series',
				'END:VEVENT',
				'BEGIN:VEVENT',
				'UID:series',
				'RECURRENCE-ID:20261121T140000Z',
				'DTSTART:20261121T140000Z',
				'DTEND:20261121T150000Z',
				'STATUS:CANCELLED',
				'SUMMARY:Series',
				'END:VEVENT',
				'BEGIN:VEVENT',
				'UID:gone',
				'DTSTART:20261120T140000Z',
				'STATUS:CANCELLED',
				'SUMMARY:Gone',
				'END:VEVENT'
			)
		);
		expect(events.map(({ exDates, fields }) => [fields.title, exDates.map(utc)])).toEqual([['Series', ['2026-11-21T14:00:00.000Z']]]);
	});

	test('imports an occurrence whose series is not in the file as its own event', () => {
		const [read] = parsed(ics('BEGIN:VEVENT', 'UID:invite', 'RECURRENCE-ID:20261121T140000Z', 'DTSTART:20261121T160000Z', 'DTEND:20261121T170000Z', 'SUMMARY:One time', 'END:VEVENT'));
		expect([read?.uid, read?.fields.rrule, utc(read?.fields.startAt)]).toEqual(['invite/2026-11-21T14:00:00Z', null, '2026-11-21T16:00:00.000Z']);
	});

	test('counts VEVENTs without a start as skipped', () => {
		const result = parseIcs(ics('BEGIN:VEVENT', 'UID:nostart', 'SUMMARY:No start', 'END:VEVENT'), OPTIONS);
		expect(result).toEqual({ ok: true, value: { events: [], skipped: 1 } });
	});
});
