import { describe, expect, test } from 'bun:test';
import type { Reminder } from '@tempi/core';
import { reminderContent } from './reminder-notification';

const T0 = '2026-11-15T10:00:00.000Z';
const LIMA = { language: 'en', timeFormat: '24h', timeZone: 'America/Lima' } as const;

const reminder = (overrides: Partial<Reminder['occurrence']> = {}, fireAt = '2026-11-20T13:50:00.000Z'): Reminder => ({
	fireAt,
	occurrence: {
		allDay: false,
		calendarId: 'cal-1',
		createdAt: T0,
		deletedAt: null,
		description: null,
		endAt: '2026-11-20T15:00:00.000Z',
		exDates: [],
		id: 'event-1',
		key: 'event-1',
		location: null,
		originalStartAt: null,
		recurringEventId: null,
		reminderMinutes: 10,
		rrule: null,
		series: null,
		startAt: '2026-11-20T14:00:00.000Z',
		status: 'confirmed',
		timeZone: 'America/Lima',
		title: 'Standup',
		updatedAt: T0,
		videoUrl: null,
		...overrides,
	},
});

// ICU picks the separators and spaces; compare without them.
const plain = (text: string) => text.replace(/\s+/g, ' ');

describe('reminderContent', () => {
	test('titles the notification with the event and shows its times in the user zone', () => {
		const { body, title } = reminderContent(reminder(), LIMA);
		expect(title).toBe('Standup');
		expect(plain(body)).toMatch(/^09:00 – 10:00$/);
	});

	test('follows the 12-hour format and adds the location', () => {
		const { body } = reminderContent(reminder({ location: 'Room 4' }), { ...LIMA, timeFormat: '12h' });
		expect(plain(body)).toMatch(/^9:00 – 10:00 AM · Room 4$/);
	});

	test('names the day when the event is on a later day than the reminder', () => {
		const { body } = reminderContent(reminder({}, '2026-11-19T14:00:00.000Z'), LIMA);
		expect(plain(body)).toContain('Fri, Nov 20');
	});

	test('shows an all-day event as its date in its own zone, in the user language', () => {
		const { body } = reminderContent(reminder({ allDay: true, endAt: '2026-11-21T05:00:00.000Z', startAt: '2026-11-20T05:00:00.000Z' }), { ...LIMA, language: 'es', timeZone: 'Asia/Tokyo' });
		expect(body).toBe('viernes, 20 de noviembre de 2026');
	});
});
