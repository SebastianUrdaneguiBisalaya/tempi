import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DatabaseSync } from 'node:sqlite';
import { type AvatarImage, type Calendar, type CalendarRepository, type CoreDeps, type Settings, type UserProfile, uuidv7Ids } from '@tempi/core';
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
let avatars: Map<string, AvatarImage>;

/** Registers the handlers over a fresh in-memory database; `override` swaps ports to inject failures. */
const setup = (override: (deps: CoreDeps) => Partial<CoreDeps> = () => ({}), listeners: IpcListeners = {}) => {
	db = openDatabase(':memory:', { clock });
	handlers = new Map();
	avatars = new Map();
	const avatarStore = {
		remove: async (fileName: string) => void avatars.delete(fileName),
		save: async (fileName: string, image: AvatarImage) => void avatars.set(fileName, image),
	};
	const deps: CoreDeps = { ...createRepositories(db), avatars: avatarStore, clock, ids: uuidv7Ids };
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
		expect(await invoke(CHANNELS.events.search, 'STAND')).toMatchObject({ ok: true, value: [{ title: 'Standup' }] });
		expect(await invoke(CHANNELS.settings.save, { theme: 'dark' })).toMatchObject({ ok: true, value: { theme: 'dark', weekStart: 'monday' } });
	});

	test('restores a deleted event', async () => {
		const range = { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' };
		const created = await invoke(CHANNELS.events.create, newEvent(seededCalendarId()));
		if (typeof created !== 'object' || created === null || !('value' in created) || typeof created.value !== 'object' || created.value === null || !('id' in created.value))
			throw new Error('create failed');
		const { id } = created.value;
		await invoke(CHANNELS.events.delete, id);
		expect(await invoke(CHANNELS.events.list, range)).toEqual({ ok: true, value: [] });
		expect(await invoke(CHANNELS.events.restore, id)).toMatchObject({ ok: true, value: { deletedAt: null, id } });
		expect(await invoke(CHANNELS.events.list, range)).toMatchObject({ ok: true, value: [{ id }] });
	});

	test('edits and deletes occurrences of a recurring event', async () => {
		const range = { end: '2026-11-23T00:00:00Z', start: '2026-11-20T00:00:00Z' };
		const created = await invoke(CHANNELS.events.create, { ...newEvent(seededCalendarId()), rrule: 'FREQ=DAILY' });
		if (typeof created !== 'object' || created === null || !('value' in created) || typeof created.value !== 'object' || created.value === null || !('id' in created.value))
			throw new Error('create failed');
		const seriesId = String(created.value.id);
		const target = { originalStartAt: '2026-11-21T14:00:00Z', seriesId };

		expect(await invoke(CHANNELS.events.updateOccurrence, { ...target, scope: 'this', title: 'Moved' })).toMatchObject({ ok: true, value: { recurringEventId: seriesId, title: 'Moved' } });
		expect(await invoke(CHANNELS.events.deleteOccurrence, { ...target, originalStartAt: '2026-11-22T14:00:00Z', scope: 'this' })).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.events.list, range)).toMatchObject({ ok: true, value: [{ key: `${seriesId}:2026-11-20T14:00:00.000Z`, title: 'Standup' }, { title: 'Moved' }] });
	});

	test('duplicates an event', async () => {
		const created = await invoke(CHANNELS.events.create, newEvent(seededCalendarId()));
		if (typeof created !== 'object' || created === null || !('value' in created) || typeof created.value !== 'object' || created.value === null || !('id' in created.value))
			throw new Error('create failed');
		const copy = await invoke(CHANNELS.events.duplicate, created.value.id);
		expect(copy).toMatchObject({ ok: true, value: { startAt: '2026-11-20T14:00:00.000Z', title: 'Standup' } });
		expect(copy).not.toMatchObject({ value: { id: created.value.id } });
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
		expect(await invoke(CHANNELS.calendars.delete, { id: seededCalendarId(), moveEventsTo: null })).toMatchObject({
			error: { code: 'conflict', issues: [{ key: 'calendar.defaultNotDeletable' }] },
			ok: false,
		});
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

describe('onboarding:complete', () => {
	const onboarding = { avatar: null, country: 'pe', firstName: 'Ana', language: 'es', lastName: 'Quispe', theme: 'dark', timeZone: 'America/Lima' };

	test('saves the profile, the avatar and the completed settings', async () => {
		setup();
		const avatar: AvatarImage = { bytes: new Uint8Array([1, 2, 3]), type: 'image/png' };
		const result = await invoke(CHANNELS.onboarding.complete, { ...onboarding, avatar });

		expect(result).toMatchObject({
			ok: true,
			value: { profile: { avatar: expect.stringMatching(/\.png$/), country: 'PE' }, settings: { language: 'es', onboardingCompleted: true, theme: 'dark' } },
		});
		expect([...avatars.values()]).toEqual([avatar]);
		expect(rows('SELECT first_name, avatar FROM profile')).toEqual([expect.objectContaining({ avatar: [...avatars.keys()][0], first_name: 'Ana' })]);
	});

	test('keeps the profile unsaved when the settings write fails', async () => {
		setup(deps => ({ settings: { get: () => deps.settings.get(), save: () => Promise.reject(new Error('disk I/O error')) } }));
		expect(await invoke(CHANNELS.onboarding.complete, onboarding)).toMatchObject({ ok: false });
		expect(rows('SELECT * FROM profile')).toEqual([]);
	});

	test('notifies the saved settings once committed', async () => {
		const saved: Settings[] = [];
		setup(undefined, { settingsSaved: settings => saved.push(settings) });
		await invoke(CHANNELS.onboarding.complete, onboarding);
		expect(saved).toEqual([expect.objectContaining({ onboardingCompleted: true, theme: 'dark' })]);
	});
});

describe('profile:update', () => {
	const onboarding = { avatar: null, country: 'pe', firstName: 'Ana', language: 'es', lastName: 'Quispe', theme: 'dark', timeZone: 'America/Lima' };

	test('stores a new avatar and keeps it on later updates without one', async () => {
		setup();
		await invoke(CHANNELS.onboarding.complete, onboarding);
		const avatar: AvatarImage = { bytes: new Uint8Array([4, 5, 6]), type: 'image/webp' };

		expect(await invoke(CHANNELS.profile.update, { country: 'PE', firstName: 'Ana María', lastName: 'Quispe', timeZone: 'America/Lima', avatar })).toMatchObject({
			ok: true,
			value: { avatar: expect.stringMatching(/\.webp$/), firstName: 'Ana María' },
		});
		expect([...avatars.values()]).toEqual([avatar]);
		expect(await invoke(CHANNELS.profile.update, { country: 'PE', firstName: 'Ana', lastName: 'Quispe', timeZone: 'America/Lima' })).toMatchObject({
			ok: true,
			value: { avatar: [...avatars.keys()][0], firstName: 'Ana' },
		});
	});
});

describe('profile:update avatar files', () => {
	const onboarding = { country: 'pe', firstName: 'Ana', language: 'es', lastName: 'Quispe', theme: 'dark', timeZone: 'America/Lima' };
	const fields = { country: 'PE', firstName: 'Ana', lastName: 'Quispe', timeZone: 'America/Lima' };
	const first: AvatarImage = { bytes: new Uint8Array([1]), type: 'image/png' };
	const second: AvatarImage = { bytes: new Uint8Array([2]), type: 'image/png' };

	test('deletes the replaced image once the update is committed', async () => {
		setup();
		await invoke(CHANNELS.onboarding.complete, { ...onboarding, avatar: first });
		await invoke(CHANNELS.profile.update, { ...fields, avatar: second });
		expect([...avatars.values()]).toEqual([second]);

		await invoke(CHANNELS.profile.update, { ...fields, avatar: null });
		expect(avatars.size).toBe(0);
	});

	test('keeps the current image when the update fails', async () => {
		setup(deps => ({
			profile: { get: () => deps.profile.get(), save: (profile: UserProfile) => (profile.firstName === 'Fail' ? Promise.reject(new Error('disk I/O error')) : deps.profile.save(profile)) },
		}));
		await invoke(CHANNELS.onboarding.complete, { ...onboarding, avatar: first });
		const [current] = [...avatars.keys()];

		expect(await invoke(CHANNELS.profile.update, { ...fields, avatar: second, firstName: 'Fail' })).toMatchObject({ ok: false });
		expect(avatars.get(current ?? '')).toEqual(first);
		expect(rows('SELECT avatar FROM profile')).toEqual([expect.objectContaining({ avatar: current })]);
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
		expect(await invoke(CHANNELS.calendars.delete, { id: calendarId, moveEventsTo: null })).toMatchObject({ ok: false });
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
