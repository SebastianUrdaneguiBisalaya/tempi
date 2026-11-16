import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DatabaseSync } from 'node:sqlite';
import { createRepositories, openDatabase } from '@tempi/db';
import { CHANNELS, type Channel } from '@tempi/ipc';
import type { IpcSender } from './handle';
import { registerIpc } from './register-ipc';

const TRUSTED = 'app://tempi';
const T0 = '2026-11-15T10:00:00.000Z';

let db: DatabaseSync;
let handlers: Map<string, (event: IpcSender, payload: unknown) => Promise<unknown>>;

beforeEach(() => {
	db = openDatabase(':memory:', { clock: { now: () => new Date(T0) } });
	handlers = new Map();
	registerIpc({ ipc: { handle: (channel, listener) => handlers.set(channel, listener) }, isTrusted: url => url.startsWith(`${TRUSTED}/`) }, createRepositories(db));
});

afterEach(() => db.close());

const invoke = (channel: Channel, payload?: unknown, url = `${TRUSTED}/`) => {
	const listener = handlers.get(channel);
	if (listener === undefined) throw new Error(`No handler for ${channel}`);
	return listener({ senderFrame: { url } }, payload);
};

const event = (calendarId: string) => ({
	allDay: false,
	calendarId,
	createdAt: T0,
	deletedAt: null,
	description: null,
	endAt: '2026-11-20T10:00:00.000Z',
	id: 'evt-1',
	location: null,
	reminderMinutes: null,
	rrule: null,
	startAt: '2026-11-20T09:00:00.000Z',
	status: 'confirmed',
	timeZone: 'America/Lima',
	title: 'Standup',
	updatedAt: T0,
	videoUrl: null,
});

const seededCalendarId = async (): Promise<string> => {
	const listed = await invoke(CHANNELS.calendars.list);
	if (typeof listed !== 'object' || listed === null || !('value' in listed) || !Array.isArray(listed.value)) throw new Error('No calendars');
	return String(listed.value[0]?.id);
};

describe('registerIpc', () => {
	test('registers exactly one handler per channel', () => {
		const channels = Object.values(CHANNELS).flatMap(group => Object.values(group));
		expect([...handlers.keys()].sort()).toEqual(channels.sort());
	});

	test('reads and writes through the repositories', async () => {
		const calendarId = await seededCalendarId();
		expect(await invoke(CHANNELS.events.save, event(calendarId))).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.events.list, { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' })).toEqual({ ok: true, value: [event(calendarId)] });
		expect(await invoke(CHANNELS.settings.get)).toEqual({ ok: true, value: null });
	});

	test('rejects an invalid payload with every issue, without touching storage', async () => {
		const result = await invoke(CHANNELS.events.save, { ...event('cal'), endAt: 'soon', title: '' });
		expect(result).toMatchObject({ error: { code: 'validation', issues: [expect.objectContaining({ field: 'endAt' }), expect.objectContaining({ field: 'title' })] }, ok: false });
		expect(await invoke(CHANNELS.events.get, 'evt-1')).toEqual({ ok: true, value: null });
	});

	test('refuses senders from another origin', async () => {
		expect(await invoke(CHANNELS.calendars.list, undefined, 'https://evil.example/')).toMatchObject({ error: { code: 'internal', issues: [{ key: 'system.unexpected' }] }, ok: false });
	});

	test('returns a storage failure as a result instead of throwing', async () => {
		const result = await invoke(CHANNELS.events.save, event('missing-calendar'));
		expect(result).toMatchObject({ error: { code: 'internal', issues: [{ detail: expect.stringContaining('events:save failed'), key: 'system.unexpected' }] }, ok: false });
	});
});
