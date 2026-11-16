import { describe, expect, test } from 'bun:test';
import { parseWith } from '@tempi/core';
import { CHANNELS } from './channels';
import { payloadSchemas, resultSchema } from './schemas';

const T0 = '2026-11-15T10:00:00.000Z';

const calendar = { color: '#3b82f6', createdAt: T0, deletedAt: null, id: 'cal-1', isDefault: true, isVisible: true, name: 'Personal', source: 'local', updatedAt: T0 };

const newEvent = { calendarId: 'cal-1', endAt: '2026-11-20T10:00:00-05:00', startAt: '2026-11-20T09:00:00-05:00', timeZone: 'America/Lima', title: 'Standup' };

const profile = { country: 'pe', firstName: 'Ada', lastName: 'Lovelace', timeZone: 'America/Lima' };

const fieldsOf = (result: ReturnType<typeof parseWith>) => (result.ok ? [] : result.error.issues.map(issue => issue.field ?? '').sort());

describe('payloadSchemas', () => {
	test('has a schema for every channel', () => {
		const channels = Object.values(CHANNELS).flatMap(group => Object.values(group));
		expect(Object.keys(payloadSchemas).sort()).toEqual(channels.sort());
	});

	test.each([
		['calendars:create', { color: '#3B82F6', name: 'Work' }],
		['calendars:delete', 'cal-1'],
		['calendars:list', undefined],
		['calendars:update', { id: 'cal-1', isVisible: false }],
		['events:create', newEvent],
		['events:delete', 'evt-1'],
		['events:list', { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' }],
		['events:update', { id: 'evt-1', title: 'Retro' }],
		['profile:get', undefined],
		['profile:save', profile],
		['settings:get', undefined],
		['settings:save', { theme: 'dark' }],
	] as const)('%s accepts a valid payload', (channel, payload) => {
		expect(parseWith(payloadSchemas[channel], payload).ok).toBe(true);
	});

	test.each([
		['calendars:create', { color: 'blue', name: ' ' }, ['color', 'name']],
		['calendars:delete', '', ['']],
		['calendars:list', { unexpected: true }, ['']],
		['calendars:update', { color: 'blue' }, ['color', 'id']],
		['events:create', { ...newEvent, endAt: newEvent.startAt, timeZone: 'Mars/Base' }, ['endAt', 'timeZone']],
		['events:delete', 42, ['']],
		['events:list', { end: '2026-11-20T00:00:00Z', start: '2026-11-21T00:00:00Z' }, ['end']],
		['events:update', { id: 'evt-1', reminderMinutes: -5, title: '' }, ['reminderMinutes', 'title']],
		['profile:save', { ...profile, country: 'Peru' }, ['country']],
		['settings:save', { defaultEventDuration: 0, theme: 'neon' }, ['defaultEventDuration', 'theme']],
	] as const)('%s rejects an invalid payload, reporting every issue at form field paths', (channel, payload, fields) => {
		const result = parseWith(payloadSchemas[channel], payload);
		expect(result.ok).toBe(false);
		expect(fieldsOf(result)).toEqual([...fields]);
	});
});

describe('resultSchema', () => {
	const schema = resultSchema(payloadSchemas['calendars:delete']);

	test('accepts success and failure results', () => {
		expect(schema.safeParse({ ok: true, value: calendar.id }).success).toBe(true);
		expect(schema.safeParse({ error: { code: 'not_found', issues: [{ detail: 'gone', key: 'calendar.notFound' }] }, ok: false }).success).toBe(true);
	});

	test('rejects unknown error keys, empty issue lists and malformed values', () => {
		expect(schema.safeParse({ error: { code: 'not_found', issues: [{ detail: 'gone', key: 'calendar.vanished' }] }, ok: false }).success).toBe(false);
		expect(schema.safeParse({ error: { code: 'internal', issues: [] }, ok: false }).success).toBe(false);
		expect(schema.safeParse({ ok: true, value: 42 }).success).toBe(false);
	});
});
