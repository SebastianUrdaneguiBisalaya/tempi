import { describe, expect, test } from 'bun:test';
import { parseWith } from '@tempi/core';
import { CHANNELS } from './channels';
import { payloadSchemas, responseValueSchemas, resultSchema } from './schemas';

const T0 = '2026-11-15T10:00:00.000Z';

const calendar = { color: '#3b82f6', createdAt: T0, deletedAt: null, id: 'cal-1', isDefault: true, isVisible: true, name: 'Personal', readOnly: false, source: 'local', updatedAt: T0 };

const newEvent = { calendarId: 'cal-1', endAt: '2026-11-20T10:00:00-05:00', startAt: '2026-11-20T09:00:00-05:00', timeZone: 'America/Lima', title: 'Standup' };

const profile = { country: 'pe', firstName: 'Ada', lastName: 'Lovelace', timeZone: 'America/Lima' };

const onboarding = { ...profile, avatar: { bytes: new Uint8Array([1, 2, 3]), type: 'image/webp' }, language: 'es', theme: 'dark' };

const fieldsOf = (result: ReturnType<typeof parseWith>) => (result.ok ? [] : result.error.issues.map(issue => issue.field ?? '').sort());

describe('payloadSchemas', () => {
	test('has a schema for every channel', () => {
		const channels = Object.values(CHANNELS).flatMap(group => Object.values(group));
		expect(Object.keys(payloadSchemas).sort()).toEqual(channels.sort());
	});

	test.each([
		['app:showEvent', { key: 'event-1', startAt: '2026-11-20T09:00:00-05:00' }],
		['calendars:create', { color: '#3B82F6', name: 'Work' }],
		['calendars:delete', { id: 'cal-1', moveEventsTo: null }],
		['calendars:delete', { id: 'cal-1', moveEventsTo: 'cal-2' }],
		['calendars:export', { calendarId: null }],
		['calendars:import', { calendarId: '01890a5d-ac96-774b-bcce-b302099a8057' }],
		['calendars:list', undefined],
		['data:backup', undefined],
		['data:restore', undefined],
		['google:account', undefined],
		['google:connect', undefined],
		['google:disconnect', undefined],
		['google:calendars', undefined],
		['google:selectCalendars', { googleIds: ['ada@example.com'] }],
		['google:sync', undefined],
		['google:syncStatus', undefined],
		['updates:check', undefined],
		['updates:install', undefined],
		['updates:status', undefined],
		['calendars:update', { id: 'cal-1', isVisible: false }],
		['events:create', newEvent],
		['events:delete', 'evt-1'],
		['events:search', 'reunión'],
		['events:list', { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' }],
		['events:restore', 'evt-1'],
		['events:update', { id: 'evt-1', title: 'Retro' }],
		['events:updateOccurrence', { originalStartAt: '2026-11-20T14:00:00Z', scope: 'this', seriesId: 'evt-1', title: 'Retro' }],
		['events:deleteOccurrence', { originalStartAt: '2026-11-20T14:00:00Z', scope: 'all', seriesId: 'evt-1' }],
		['events:duplicate', 'evt-1'],
		['onboarding:complete', onboarding],
		['onboarding:complete', { ...onboarding, avatar: null }],
		['profile:get', undefined],
		['profile:update', profile],
		['profile:update', { ...profile, avatar: null }],
		['profile:update', { ...profile, avatar: { bytes: new Uint8Array([1]), type: 'image/png' } }],
		['settings:get', undefined],
		['settings:save', { theme: 'dark' }],
	] as const)('%s accepts a valid payload', (channel, payload) => {
		expect(parseWith(payloadSchemas[channel], payload).ok).toBe(true);
	});

	test.each([
		['app:showEvent', { key: '', startAt: 'tomorrow' }, ['key', 'startAt']],
		['calendars:create', { color: 'blue', name: ' ' }, ['color', 'name']],
		['calendars:delete', { id: '', moveEventsTo: '' }, ['id', 'moveEventsTo']],
		['calendars:list', { unexpected: true }, ['']],
		['calendars:update', { color: 'blue' }, ['color', 'id']],
		['events:create', { ...newEvent, endAt: newEvent.startAt, timeZone: 'Mars/Base' }, ['endAt', 'timeZone']],
		['events:delete', 42, ['']],
		['events:search', '  ', ['']],
		['events:duplicate', '', ['']],
		['events:list', { end: '2026-11-20T00:00:00Z', start: '2026-11-21T00:00:00Z' }, ['end']],
		['events:update', { id: 'evt-1', reminderMinutes: -5, title: '' }, ['reminderMinutes', 'title']],
		['events:updateOccurrence', { originalStartAt: 'soon', scope: 'some', seriesId: 'evt-1', title: '' }, ['originalStartAt', 'scope', 'title']],
		['events:deleteOccurrence', { originalStartAt: '2026-11-20T14:00:00Z', scope: 'this' }, ['seriesId']],
		['onboarding:complete', { ...onboarding, avatar: { bytes: 'abc', type: 'image/gif' }, firstName: '', language: 'fr' }, ['avatar.bytes', 'avatar.type', 'firstName', 'language']],
		['profile:update', { ...profile, avatar: '../../secrets.png', country: 'Peru' }, ['avatar', 'country']],
		['settings:save', { defaultEventDuration: 0, theme: 'neon' }, ['defaultEventDuration', 'theme']],
	] as const)('%s rejects an invalid payload, reporting every issue at form field paths', (channel, payload, fields) => {
		const result = parseWith(payloadSchemas[channel], payload);
		expect(result.ok).toBe(false);
		expect(fieldsOf(result)).toEqual([...fields]);
	});
});

describe('resultSchema', () => {
	const schema = resultSchema(payloadSchemas['events:delete']);

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

describe('google answers', () => {
	const connect = resultSchema(responseValueSchemas['google:connect']);

	test('accept a connected account or a canceled sign-in', () => {
		expect(connect.safeParse({ ok: true, value: { account: { email: 'ada@example.com' }, status: 'connected' } }).success).toBe(true);
		expect(connect.safeParse({ ok: true, value: { status: 'canceled' } }).success).toBe(true);
		expect(resultSchema(responseValueSchemas['google:account']).safeParse({ ok: true, value: null }).success).toBe(true);
	});

	test('reject an account without a valid email', () => {
		expect(connect.safeParse({ ok: true, value: { account: { email: 'ada' }, status: 'connected' } }).success).toBe(false);
	});

	test('drop anything but the email, so tokens could never reach the renderer', () => {
		const parsed = connect.parse({ ok: true, value: { account: { email: 'ada@example.com', refreshToken: 'secret' }, status: 'connected' } });
		expect(parsed).toEqual({ ok: true, value: { account: { email: 'ada@example.com' }, status: 'connected' } });
	});
});

describe('update answers', () => {
	const status = resultSchema(responseValueSchemas['updates:status']);
	const available = {
		checkedAt: '2026-11-16T12:00:00Z',
		currentVersion: '0.1.0',
		downloadUrl: 'https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/tag/v0.2.0',
		latestVersion: '0.2.0',
		state: 'available',
	};

	test('accept a newer release to download', () => {
		expect(status.safeParse({ ok: true, value: available }).success).toBe(true);
	});

	test('reject a download link that is not https', () => {
		expect(status.safeParse({ ok: true, value: { ...available, downloadUrl: 'http://example.com/tempi.dmg' } }).success).toBe(false);
		expect(status.safeParse({ ok: true, value: { ...available, downloadUrl: 'file:///Applications/Tempi.app' } }).success).toBe(false);
	});

	test('reject an unknown state', () => {
		expect(status.safeParse({ ok: true, value: { ...available, state: 'installing' } }).success).toBe(false);
	});
});
