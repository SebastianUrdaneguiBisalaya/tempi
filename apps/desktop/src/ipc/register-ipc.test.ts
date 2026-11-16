import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DatabaseSync } from 'node:sqlite';
import { type Calendar, type CalendarRepository, type CoreDeps, type Settings, uuidv7Ids } from '@tempi/core';
import { createRepositories, createTransactionQueue, openDatabase } from '@tempi/db';
import { CHANNELS, type Channel } from '@tempi/ipc';
import type { IpcSender } from './handle';
import { type IpcListeners, registerIpc } from './register-ipc';

const TRUSTED = 'app://tempi';
const T0 = '2026-11-15T10:00:00.000Z';
const clock = { now: () => new Date(T0) };

type Listener = (event: IpcSender, payload: unknown) => Promise<unknown>;

let db: DatabaseSync;
let handlers: Map<string, Listener>;

/** Registers the handlers over a fresh in-memory database; `override` swaps ports to inject failures. */
const setup = (override: (deps: CoreDeps) => Partial<CoreDeps> = () => ({}), listeners: IpcListeners = {}) => {
	db = openDatabase(':memory:', { clock });
	handlers = new Map();
	const deps: CoreDeps = { ...createRepositories(db), clock, ids: uuidv7Ids };
	registerIpc(
		{ ipc: { handle: (channel, listener) => handlers.set(channel, listener) }, isTrusted: url => url.startsWith(`${TRUSTED}/`), transaction: createTransactionQueue(db) },
		{ ...deps, ...override(deps) },
		listeners
	);
};

afterEach(() => db.close());

const invoke = (channel: Channel, payload?: unknown, url = `${TRUSTED}/`) => {
	const listener = handlers.get(channel);
	if (listener === undefined) throw new Error(`No handler for ${channel}`);
	return listener({ senderFrame: { url } }, payload);
};

const rows = (sql: string) => db.prepare(sql).all();

const seededCalendarId = (): string => String(rows('SELECT id FROM calendars')[0]?.id);

const newEvent = (calendarId: string) => ({ calendarId, endAt: '2026-11-20T10:00:00-05:00', startAt: '2026-11-20T09:00:00-05:00', timeZone: 'America/Lima', title: 'Standup' });

/** Calendar port whose `save` throws on the given call, simulating a crash halfway through a use case. */
const saveFailsOnCall = (calendars: CalendarRepository, failingCall: number): CalendarRepository => {
	let calls = 0;
	return {
		findById: id => calendars.findById(id),
		list: () => calendars.list(),
		save: (calendar: Calendar) => (++calls === failingCall ? Promise.reject(new Error('disk I/O error')) : calendars.save(calendar)),
	};
};

describe('registerIpc', () => {
	beforeEach(() => setup());

	test('registers exactly one handler per channel', () => {
		const channels = Object.values(CHANNELS).flatMap(group => Object.values(group));
		expect([...handlers.keys()].sort()).toEqual(channels.sort());
	});

	test('runs use cases end to end', async () => {
		expect(await invoke(CHANNELS.events.create, newEvent(seededCalendarId()))).toMatchObject({ ok: true, value: { startAt: '2026-11-20T14:00:00.000Z', title: 'Standup' } });
		expect(await invoke(CHANNELS.events.list, { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' })).toMatchObject({ ok: true, value: [{ title: 'Standup' }] });
		expect(await invoke(CHANNELS.settings.save, { theme: 'dark' })).toMatchObject({ ok: true, value: { theme: 'dark', weekStart: 'monday' } });
	});

	test('updates take the id next to the patch fields', async () => {
		const id = seededCalendarId();
		expect(await invoke(CHANNELS.calendars.update, { id, name: 'Home' })).toMatchObject({ ok: true, value: { id, name: 'Home' } });
	});

	test('rejects an invalid payload with every issue, without touching storage', async () => {
		const result = await invoke(CHANNELS.events.create, { ...newEvent(seededCalendarId()), endAt: 'soon', title: '' });
		expect(result).toMatchObject({ error: { code: 'validation', issues: [expect.objectContaining({ field: 'endAt' }), expect.objectContaining({ field: 'title' })] }, ok: false });
		expect(rows('SELECT id FROM events')).toEqual([]);
	});

	test('returns domain failures from the use case', async () => {
		expect(await invoke(CHANNELS.calendars.delete, seededCalendarId())).toMatchObject({ error: { code: 'conflict', issues: [{ key: 'calendar.defaultNotDeletable' }] }, ok: false });
	});

	test('refuses senders from another origin', async () => {
		expect(await invoke(CHANNELS.calendars.list, undefined, 'https://evil.example/')).toMatchObject({ error: { code: 'internal', issues: [{ key: 'system.unexpected' }] }, ok: false });
	});

	test('runs concurrent calls one at a time, so exactly one calendar stays default', async () => {
		const results = await Promise.all([
			invoke(CHANNELS.calendars.create, { color: '#ff0000', isDefault: true, name: 'Work' }),
			invoke(CHANNELS.calendars.create, { color: '#00ff00', isDefault: true, name: 'Home' }),
		]);
		expect(results).toEqual([expect.objectContaining({ ok: true }), expect.objectContaining({ ok: true })]);
		expect(rows('SELECT name FROM calendars WHERE is_default = 1')).toEqual([expect.objectContaining({ name: 'Home' })]);
		expect(rows('SELECT id FROM calendars')).toHaveLength(3);
	});
});

describe('a use case that fails halfway', () => {
	test('creating a default calendar leaves no new calendar and the old default intact', async () => {
		// Call 1 saves the new calendar; call 2 (unsetting the previous default) fails.
		setup(deps => ({ calendars: saveFailsOnCall(deps.calendars, 2) }));
		const before = rows('SELECT * FROM calendars');

		const result = await invoke(CHANNELS.calendars.create, { color: '#ff0000', isDefault: true, name: 'Work' });

		expect(result).toMatchObject({ error: { code: 'internal', issues: [{ detail: expect.stringContaining('disk I/O error') }] }, ok: false });
		expect(rows('SELECT * FROM calendars')).toEqual(before);
	});

	test('deleting a calendar keeps its events when the calendar write fails', async () => {
		setup(deps => ({ calendars: saveFailsOnCall(deps.calendars, 2) }));
		const created = await invoke(CHANNELS.calendars.create, { color: '#ff0000', name: 'Work' });
		const calendarId = typeof created === 'object' && created !== null && 'value' in created ? String((created.value as Calendar).id) : '';
		await invoke(CHANNELS.events.create, newEvent(calendarId));

		// deleteCalendar soft-deletes the events first, then saves the calendar (call 2, which fails).
		expect(await invoke(CHANNELS.calendars.delete, calendarId)).toMatchObject({ ok: false });
		expect(rows('SELECT deleted_at FROM events')).toEqual([expect.objectContaining({ deleted_at: null })]);
		expect(rows(`SELECT deleted_at FROM calendars WHERE name = 'Work'`)).toEqual([expect.objectContaining({ deleted_at: null })]);
	});
});

describe('settingsSaved listener', () => {
	let saved: Settings[];
	const listeners: IpcListeners = { settingsSaved: settings => saved.push(settings) };

	beforeEach(() => {
		saved = [];
	});

	test('receives the committed settings after a save', async () => {
		setup(undefined, listeners);
		await invoke(CHANNELS.settings.save, { theme: 'dark' });
		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject({ theme: 'dark' });
	});

	test('is not called when the save is invalid or rolled back', async () => {
		setup(deps => ({ settings: { get: () => deps.settings.get(), save: () => Promise.reject(new Error('disk I/O error')) } }), listeners);
		expect(await invoke(CHANNELS.settings.save, { theme: 'neon' })).toMatchObject({ ok: false });
		expect(await invoke(CHANNELS.settings.save, { theme: 'dark' })).toMatchObject({ ok: false });
		expect(saved).toEqual([]);
	});
});
