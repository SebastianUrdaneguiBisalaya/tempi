import { describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS, parseWith } from '@tempi/core';
import { CHANNELS } from './channels';
import { payloadSchemas, resultSchema } from './schemas';

const T0 = '2026-11-15T10:00:00.000Z';

const calendar = { color: '#3b82f6', createdAt: T0, deletedAt: null, id: 'cal-1', isDefault: true, isVisible: true, name: 'Personal', source: 'local', updatedAt: T0 };

const event = {
	allDay: false,
	calendarId: 'cal-1',
	createdAt: T0,
	deletedAt: null,
	description: null,
	endAt: '2026-11-20T10:00:00.000Z',
	id: 'evt-1',
	location: null,
	reminderMinutes: 10,
	rrule: null,
	startAt: '2026-11-20T09:00:00.000Z',
	status: 'confirmed',
	timeZone: 'America/Lima',
	title: 'Standup',
	updatedAt: T0,
	videoUrl: null,
};

const profile = { avatar: null, country: 'PE', createdAt: T0, firstName: 'Ada', lastName: 'Lovelace', timeZone: 'America/Lima', updatedAt: T0 };

const settings = { ...DEFAULT_SETTINGS, createdAt: T0, updatedAt: T0 };

const fieldsOf = (result: ReturnType<typeof parseWith>) => (result.ok ? [] : result.error.issues.map(issue => issue.field ?? '').sort());

describe('payloadSchemas', () => {
	test('has a schema for every channel', () => {
		const channels = Object.values(CHANNELS).flatMap(group => Object.values(group));
		expect(Object.keys(payloadSchemas).sort()).toEqual(channels.sort());
	});

	test.each([
		['calendars:get', 'cal-1'],
		['calendars:list', undefined],
		['calendars:save', calendar],
		['events:deleteByCalendar', { calendarId: 'cal-1', deletedAt: T0 }],
		['events:get', 'evt-1'],
		['events:list', { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' }],
		['events:save', event],
		['profile:get', undefined],
		['profile:save', profile],
		['settings:get', undefined],
		['settings:save', settings],
	] as const)('%s accepts a valid payload', (channel, payload) => {
		expect(parseWith(payloadSchemas[channel], payload).ok).toBe(true);
	});

	test.each([
		['calendars:get', '', ['']],
		['calendars:list', { unexpected: true }, ['']],
		['calendars:save', { ...calendar, color: 'blue', id: undefined }, ['color', 'id']],
		['events:deleteByCalendar', { calendarId: 'cal-1', deletedAt: 'yesterday' }, ['deletedAt']],
		['events:get', 42, ['']],
		['events:list', { end: '2026-11-20T00:00:00Z', start: '2026-11-21T00:00:00Z' }, ['end']],
		['events:save', { ...event, endAt: event.startAt, title: ' ' }, ['endAt', 'title']],
		['profile:save', { ...profile, country: 'Peru' }, ['country']],
		['settings:save', { ...settings, defaultEventDuration: 0, theme: 'neon' }, ['defaultEventDuration', 'theme']],
	] as const)('%s rejects an invalid payload, reporting every issue', (channel, payload, fields) => {
		const result = parseWith(payloadSchemas[channel], payload);
		expect(result.ok).toBe(false);
		expect(fieldsOf(result)).toEqual([...fields]);
	});

	test('rejects a payload missing the stored-entity fields', () => {
		const { createdAt: _createdAt, ...withoutCreatedAt } = event;
		expect(fieldsOf(parseWith(payloadSchemas['events:save'], withoutCreatedAt))).toEqual(['createdAt']);
	});
});

describe('resultSchema', () => {
	const schema = resultSchema(payloadSchemas['calendars:save']);

	test('accepts success and failure results', () => {
		expect(schema.safeParse({ ok: true, value: calendar }).success).toBe(true);
		expect(schema.safeParse({ error: { code: 'not_found', issues: [{ detail: 'gone', key: 'calendar.notFound' }] }, ok: false }).success).toBe(true);
	});

	test('rejects unknown error keys, empty issue lists and malformed values', () => {
		expect(schema.safeParse({ error: { code: 'not_found', issues: [{ detail: 'gone', key: 'calendar.vanished' }] }, ok: false }).success).toBe(false);
		expect(schema.safeParse({ error: { code: 'internal', issues: [] }, ok: false }).success).toBe(false);
		expect(schema.safeParse({ ok: true, value: { ...calendar, isDefault: 'yes' } }).success).toBe(false);
	});
});
