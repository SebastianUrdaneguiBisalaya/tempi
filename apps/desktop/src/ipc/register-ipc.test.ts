import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DatabaseSync } from 'node:sqlite';
import { type AiSettings, type AvatarImage, type Calendar, type CalendarRepository, type CoreDeps, DEFAULT_AI_SETTINGS, fail, ok, type Settings, type UserProfile, uuidv7Ids } from '@tempi/core';
import { createRepositories, createTransactionQueue, openDatabase } from '@tempi/db';
import { parseIcs, serializeIcs } from '@tempi/ical';
import { CHANNELS, type Channel } from '@tempi/ipc';
import type { AiService } from '../ai/ai-service';
import type { GoogleAccountService } from '../google/google-account';
import type { SyncRunner } from '../google/sync-runner';
import { createUpdateService } from '../updates/update-service';
import type { IpcSender } from './handle';
import { type AiIo, type DataIo, type IcalIo, type IpcListeners, type PermissionsIo, registerIpc } from './register-ipc';

const TRUSTED = 'app://tempi';
const T0 = '2026-11-15T10:00:00.000Z';
const clock = { now: () => new Date(T0) };

type Listener = (event: IpcSender, payload: unknown) => Promise<unknown>;

let db: DatabaseSync;
let handlers: Map<string, Listener>;
let avatars: Map<string, AvatarImage>;
/** What the fake open dialog returns (null: canceled), and what export dialogs and writes saw. */
let importText: string | null;
let exportPath: string | null;
let written: { path: string; text: string }[];

/** What the fake backup and restore dialogs return (null: canceled), and what they were asked to do. */
let backupPath: string | null;
let restoreSource: string | null;
let dataCalls: string[];

const dataIo: DataIo = {
	backup: target => {
		dataCalls.push(`backup ${target}`);
		return Promise.resolve();
	},
	chooseBackupPath: name => Promise.resolve(backupPath === null ? null : `${backupPath}/${name}`),
	chooseRestoreFile: () => Promise.resolve(restoreSource),
	now: () => new Date(T0),
	restore: source => {
		dataCalls.push(`restore ${source}`);
		return Promise.resolve(source.endsWith('.db') ? ok(null) : fail('validation', 'backup.invalidFile'));
	},
};

/** The fake AI service: accepts only `good-key` and records the keys it was given. */
let aiKeys: Map<string, string>;
const aiView = async (): Promise<AiSettings> => ({
	...DEFAULT_AI_SETTINGS,
	keys: { anthropic: aiKeys.has('anthropic'), elevenlabs: aiKeys.has('elevenlabs'), google: aiKeys.has('google'), groq: aiKeys.has('groq'), openai: aiKeys.has('openai'), xai: aiKeys.has('xai') },
});
const aiService: AiService = {
	getSettings: aiView,
	listVoices: async () => ok([]),
	removeKey: async provider => {
		aiKeys.delete(provider);
		return ok(await aiView());
	},
	saveKey: async ({ key, provider }) => {
		if (key !== 'good-key') return fail('validation', 'ai.invalidKey', { field: 'key' });
		aiKeys.set(provider, key);
		return ok(await aiView());
	},
	saveSettings: async () => ok(await aiView()),
	testKey: async provider => (aiKeys.has(provider) ? ok(null) : fail('not_found', 'ai.invalidKey')),
	speak: () => Promise.resolve(ok({ audio: new Uint8Array([73, 68, 51]), mimeType: 'audio/mpeg' as const })),
	transcribe: () => Promise.resolve(ok({ text: 'hola' })),
};

/** Assistant replies started, and the streams opened for them. */
let chats: { input: unknown; requestId: string }[];
/** Texts sent to AI quick add. */
let quickAdds: string[] = [];
const ai: AiIo = {
	chat: (input, openSink) => {
		openSink().send({ type: 'done' });
		chats.push({ input, requestId: input.requestId });
		return Promise.resolve(ok(null));
	},
	openStream: () => ({ close: () => undefined, send: () => undefined, signal: new AbortController().signal }),
	quickAdd: ({ text }) => {
		quickAdds.push(text);
		return Promise.resolve(
			ok({ allDay: false, description: null, endAt: '2026-11-20T23:00:00.000Z', location: 'Larcomar', reminderMinutes: 30, startAt: '2026-11-20T22:00:00.000Z', title: 'Café con Ana' })
		);
	},
	service: aiService,
};

/** The fake Google service: one account at most, like the real one. */
let googleEmail: string | null;

const google: GoogleAccountService = {
	account: () => Promise.resolve(googleEmail === null ? null : { email: googleEmail }),
	connect: () => {
		if (googleEmail !== null) return Promise.resolve(fail('conflict', 'google.alreadyConnected'));
		googleEmail = 'ada@example.com';
		return Promise.resolve(ok({ account: { email: googleEmail }, status: 'connected' as const }));
	},
	accessToken: () => Promise.resolve(ok('token')),
	disconnect: () => {
		googleEmail = null;
		return Promise.resolve(ok(null));
	},
};

/** What the fake sync runner was asked to do. */
let syncCalls: string[];

const IDLE = { error: null, lastSyncedAt: null, state: 'idle' } as const;

const sync: SyncRunner = {
	schedule: () => void syncCalls.push('schedule'),
	start: () => void syncCalls.push('start'),
	status: () => IDLE,
	stop: () => {
		syncCalls.push('stop');
		return Promise.resolve();
	},
	syncNow: () => {
		syncCalls.push('syncNow');
		return Promise.resolve({ ...IDLE, lastSyncedAt: T0 });
	},
};

const icalIo: IcalIo = {
	chooseExportPath: name => Promise.resolve(exportPath === null ? null : `${exportPath}/${name}`),
	chooseImportFile: () => Promise.resolve(importText),
	now: () => new Date(T0),
	parse: (text, options) => Promise.resolve(parseIcs(text, options)),
	serialize: (data, now) => Promise.resolve(serializeIcs(data, now)),
	writeFile: (path, text) => {
		written.push({ path, text });
		return Promise.resolve();
	},
};

/** The fake OS: macOS with the microphone denied. Records which privacy pages were opened and notifications shown. */
let permissionCalls: string[];
/** Why the fake OS refuses the next test notification, or null to show it. */
let notificationRefusal: string | null;
const permissions: PermissionsIo = {
	openSystemSettings: permission => {
		permissionCalls.push(`open ${permission}`);
		return Promise.resolve(permission === 'microphone');
	},
	status: () => ({ microphone: { canOpenSettings: true, state: 'denied' }, notifications: { canOpenSettings: true, state: 'unknown' } }),
	testNotification: () => {
		permissionCalls.push('notify');
		return Promise.resolve(notificationRefusal === null ? { shown: true } : { reason: notificationRefusal, shown: false });
	},
};

// A newer release on GitHub, as the macOS check would find it.
const updates = () =>
	createUpdateService({
		currentVersion: '0.1.0',
		now: () => new Date(T0),
		onStatus: () => undefined,
		setTimer: () => () => undefined,
		strategy: { kind: 'notify', latestRelease: async () => ({ url: 'https://github.com/o/r/releases/tag/v0.2.0', version: '0.2.0' }) },
	});

/** Registers the handlers over a fresh in-memory database; `override` swaps ports to inject failures. */
const setup = (override: (deps: CoreDeps) => Partial<CoreDeps> = () => ({}), listeners: IpcListeners = {}) => {
	db = openDatabase(':memory:', { clock });
	handlers = new Map();
	avatars = new Map();
	importText = null;
	backupPath = '/backups';
	restoreSource = null;
	dataCalls = [];
	permissionCalls = [];
	notificationRefusal = null;
	aiKeys = new Map();
	chats = [];
	googleEmail = null;
	syncCalls = [];
	exportPath = '/exports';
	written = [];
	const avatarStore = {
		remove: async (fileName: string) => void avatars.delete(fileName),
		save: async (fileName: string, image: AvatarImage) => void avatars.set(fileName, image),
	};
	const deps: CoreDeps = { ...createRepositories(db), avatars: avatarStore, clock, ids: uuidv7Ids };
	registerIpc(
		{ ipc: { handle: (channel, listener) => handlers.set(channel, listener) }, isTrusted: url => url.startsWith(`${TRUSTED}/`), transaction: createTransactionQueue(db) },
		{ ...deps, ...override(deps) },
		{ ai, data: dataIo, google: { account: google, sync }, ical: icalIo, permissions, updates: updates() },
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

	test('availability: finds free time and validates the query', async () => {
		// A Monday far ahead, so the current time never cuts into its window.
		const found = await invoke(CHANNELS.availability.freeSlots, { from: '2030-01-07', to: '2030-01-07' });
		expect(found).toMatchObject({ ok: true, value: { days: [{ date: '2030-01-07', slots: [expect.any(Object)] }] } });
		expect(await invoke(CHANNELS.availability.freeSlots, { from: '2030-01-08', to: '2030-01-07' })).toMatchObject({ error: { code: 'validation' }, ok: false });
	});

	test('ai: validates the payload, saves a working key and never answers with it', async () => {
		expect(await invoke(CHANNELS.ai.saveKey, { key: ' ', provider: 'mistral' })).toMatchObject({ error: { code: 'validation' }, ok: false });
		expect(aiKeys.size).toBe(0);
		const saved = await invoke(CHANNELS.ai.saveKey, { key: 'good-key', provider: 'openai' });
		expect(saved).toMatchObject({ ok: true, value: { keys: { openai: true } } });
		expect(JSON.stringify(saved)).not.toContain('good-key');
		expect(await invoke(CHANNELS.ai.testKey, 'openai')).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.ai.saveKey, { key: 'bad-key', provider: 'groq' })).toMatchObject({ error: { issues: [{ key: 'ai.invalidKey' }] }, ok: false });
	});

	test('ai:chat validates the payload and only starts a reply for the app’s own frames', async () => {
		const input = { messages: [{ role: 'user', text: 'Hola' }], provider: 'openai', requestId: '01890a5d-ac96-774b-bcce-b302099a8057' };
		expect(await invoke(CHANNELS.ai.chat, { ...input, requestId: 'x' })).toMatchObject({ error: { code: 'validation' }, ok: false });
		expect(await invoke(CHANNELS.ai.chat, input, 'https://evil.example/')).toMatchObject({ error: { issues: [{ key: 'system.unexpected' }] }, ok: false });
		expect(chats).toEqual([]);
		expect(await invoke(CHANNELS.ai.chat, input)).toEqual({ ok: true, value: null });
		expect(chats).toEqual([{ input, requestId: input.requestId }]);
	});

	test('ai:quickAdd caps the text, refuses other frames and answers the proposal', async () => {
		quickAdds = [];
		expect(await invoke(CHANNELS.ai.quickAdd, { text: 'a'.repeat(501) })).toMatchObject({ error: { code: 'validation', issues: [{ field: 'text' }] }, ok: false });
		expect(await invoke(CHANNELS.ai.quickAdd, { text: 'Café' }, 'https://evil.example/')).toMatchObject({ error: { issues: [{ key: 'system.unexpected' }] }, ok: false });
		expect(quickAdds).toEqual([]);
		expect(await invoke(CHANNELS.ai.quickAdd, { text: ' Café con Ana mañana 5pm ' })).toMatchObject({ ok: true, value: { location: 'Larcomar', title: 'Café con Ana' } });
		expect(quickAdds).toEqual(['Café con Ana mañana 5pm']);
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
	const onboarding = { avatar: null, country: 'pe', firstName: 'Ana', language: 'es', lastName: 'Quispe', notificationsEnabled: false, theme: 'dark', timeZone: 'America/Lima' };

	test('saves the profile, the avatar and the completed settings', async () => {
		setup();
		const avatar: AvatarImage = { bytes: new Uint8Array([1, 2, 3]), type: 'image/png' };
		const result = await invoke(CHANNELS.onboarding.complete, { ...onboarding, avatar });

		expect(result).toMatchObject({
			ok: true,
			value: { profile: { avatar: expect.stringMatching(/\.png$/), country: 'PE' }, settings: { language: 'es', notificationsEnabled: false, onboardingCompleted: true, theme: 'dark' } },
		});
		expect([...avatars.values()]).toEqual([avatar]);
		expect(rows('SELECT first_name, avatar FROM profile')).toEqual([expect.objectContaining({ avatar: [...avatars.keys()][0], first_name: 'Ana' })]);
	});

	test('keeps the profile unsaved when the settings write fails', async () => {
		setup(deps => ({ settings: { get: () => deps.settings.get(), save: () => Promise.reject(new Error('disk I/O error')) } }));
		expect(await invoke(CHANNELS.onboarding.complete, onboarding)).toMatchObject({ ok: false });
		expect(rows('SELECT * FROM profile')).toEqual([]);
	});

	test('deletes the stored avatar when a later step fails', async () => {
		setup(deps => ({ settings: { get: () => deps.settings.get(), save: () => Promise.reject(new Error('disk I/O error')) } }));
		expect(await invoke(CHANNELS.onboarding.complete, { ...onboarding, avatar: { bytes: new Uint8Array([1]), type: 'image/png' } })).toMatchObject({ ok: false });
		expect(avatars.size).toBe(0);
	});

	test('notifies the saved settings once committed', async () => {
		const saved: Settings[] = [];
		setup(undefined, { settingsSaved: settings => saved.push(settings) });
		await invoke(CHANNELS.onboarding.complete, onboarding);
		expect(saved).toEqual([expect.objectContaining({ onboardingCompleted: true, theme: 'dark' })]);
	});
});

describe('profile:update', () => {
	const onboarding = { avatar: null, country: 'pe', firstName: 'Ana', language: 'es', lastName: 'Quispe', notificationsEnabled: false, theme: 'dark', timeZone: 'America/Lima' };

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
	const onboarding = { country: 'pe', firstName: 'Ana', language: 'es', lastName: 'Quispe', notificationsEnabled: false, theme: 'dark', timeZone: 'America/Lima' };
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

	test('keeps the current image and deletes the new one when the update fails', async () => {
		setup(deps => ({
			profile: { get: () => deps.profile.get(), save: (profile: UserProfile) => (profile.firstName === 'Fail' ? Promise.reject(new Error('disk I/O error')) : deps.profile.save(profile)) },
		}));
		await invoke(CHANNELS.onboarding.complete, { ...onboarding, avatar: first });
		const [current] = [...avatars.keys()];

		expect(await invoke(CHANNELS.profile.update, { ...fields, avatar: second, firstName: 'Fail' })).toMatchObject({ ok: false });
		// The old image stays and the new one, written before the failure, is deleted with the rollback.
		expect([...avatars.keys()]).toEqual([current ?? '']);
		expect([...avatars.values()]).toEqual([first]);
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

describe('themePreviewed listener', () => {
	test('receives each previewed theme and null when the preview is dropped, storing nothing', async () => {
		const previewed: (string | null)[] = [];
		setup(undefined, { themePreviewed: theme => previewed.push(theme) });
		const before = await invoke(CHANNELS.settings.get);
		expect(await invoke(CHANNELS.settings.previewTheme, 'system')).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.settings.previewTheme, null)).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.settings.previewTheme, 'neon')).toMatchObject({ ok: false });
		expect(previewed).toEqual(['system', null]);
		expect(await invoke(CHANNELS.settings.get)).toEqual(before);
	});
});

describe('eventsChanged listener', () => {
	let changes: number;
	const listeners: IpcListeners = { eventsChanged: () => changes++ };

	beforeEach(() => {
		changes = 0;
		setup(undefined, listeners);
	});

	test('runs after each committed event write, not after reads or failures', async () => {
		const created = await invoke(CHANNELS.events.create, newEvent(seededCalendarId()));
		expect(changes).toBe(1);

		await invoke(CHANNELS.events.list, { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' });
		await invoke(CHANNELS.events.search, 'stand');
		await invoke(CHANNELS.events.create, { ...newEvent(seededCalendarId()), title: '' });
		expect(changes).toBe(1);

		const id =
			typeof created === 'object' && created !== null && 'value' in created && typeof created.value === 'object' && created.value !== null && 'id' in created.value ? created.value.id : '';
		await invoke(CHANNELS.events.update, { id, reminderMinutes: 30 });
		await invoke(CHANNELS.events.delete, id);
		expect(changes).toBe(3);
	});

	test('runs after a calendar is hidden', async () => {
		await invoke(CHANNELS.calendars.update, { id: seededCalendarId(), isVisible: false });
		expect(changes).toBe(1);
	});
});

describe('copyText listener', () => {
	test('copies text from the trusted origin only', async () => {
		const copied: string[] = [];
		setup(undefined, { copyText: text => copied.push(text) });
		expect(await invoke(CHANNELS.app.copyText, 'Tue: 10:00–12:00')).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.app.copyText, '')).toMatchObject({ ok: false });
		expect(await invoke(CHANNELS.app.copyText, 'stolen', 'https://evil.example/')).toMatchObject({ ok: false });
		expect(copied).toEqual(['Tue: 10:00–12:00']);
	});
});

describe('showEvent listener', () => {
	test('receives the validated occurrence', async () => {
		const shown: unknown[] = [];
		setup(undefined, { showEvent: ref => shown.push(ref) });
		expect(await invoke(CHANNELS.app.showEvent, { key: 'event-1', startAt: '2026-11-20T09:00:00-05:00' })).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.app.showEvent, { key: '' })).toMatchObject({ ok: false });
		expect(await invoke(CHANNELS.app.showEvent, { key: 'event-1', startAt: '2026-11-20T14:00:00Z' }, 'https://evil.example/')).toMatchObject({ ok: false });
		expect(shown).toEqual([{ key: 'event-1', startAt: '2026-11-20T14:00:00.000Z' }]);
	});
});

describe('.ics import and export', () => {
	beforeEach(() => setup());

	/** Starts over with other ports or listeners. */
	const resetup = (...args: Parameters<typeof setup>) => {
		db.close();
		setup(...args);
	};

	const WEEK = { end: '2026-11-27T00:00:00Z', start: '2026-11-20T00:00:00Z' };
	type Listed = { ok: true; value: Record<string, unknown>[] };

	const succeeded = async (channel: Channel, payload?: unknown) => {
		const result = await invoke(channel, payload);
		if (typeof result !== 'object' || result === null || !('ok' in result) || result.ok !== true || !('value' in result)) throw new Error(`${channel} failed: ${JSON.stringify(result)}`);
		return result.value as Record<string, unknown>;
	};

	/** The fields an event shows, without what identifies where it is stored. */
	const shown = async (calendarId: string) => {
		const listed = (await invoke(CHANNELS.events.list, WEEK)) as Listed;
		return listed.value
			.filter(event => event.calendarId === calendarId)
			.map(({ calendarId: _calendar, createdAt: _created, icalUid: _uid, id: _id, key: _key, recurringEventId: _recurring, series: _series, updatedAt: _updated, ...fields }) => fields);
	};

	const seedEvents = async (calendarId: string) => {
		await invoke(CHANNELS.events.create, { ...newEvent(calendarId), description: 'Agenda', location: 'Room 4', reminderMinutes: 10, videoUrl: 'https://meet.example/x' });
		await invoke(CHANNELS.events.create, { ...newEvent(calendarId), allDay: true, endAt: '2026-11-23T05:00:00Z', startAt: '2026-11-21T05:00:00Z', title: 'Trip' });
		const series = await succeeded(CHANNELS.events.create, {
			...newEvent(calendarId),
			rrule: 'FREQ=DAILY;COUNT=5',
			startAt: '2026-11-21T09:00:00-05:00',
			endAt: '2026-11-21T09:30:00-05:00',
			title: 'Daily',
		});
		await invoke(CHANNELS.events.updateOccurrence, {
			originalStartAt: '2026-11-23T14:00:00Z',
			scope: 'this',
			seriesId: series.id,
			title: 'Daily (moved)',
			startAt: '2026-11-23T16:00:00Z',
			endAt: '2026-11-23T16:30:00Z',
		});
		await invoke(CHANNELS.events.deleteOccurrence, { originalStartAt: '2026-11-24T14:00:00Z', scope: 'this', seriesId: series.id });
	};

	test('re-importing an exported file produces the same events', async () => {
		const source = seededCalendarId();
		await seedEvents(source);
		expect(await succeeded(CHANNELS.calendars.export, { calendarId: source })).toEqual({ count: 4, status: 'exported' });
		const [file] = written;
		expect(file?.path).toMatch(/\/exports\/.+\.ics$/);

		const copy = await succeeded(CHANNELS.calendars.create, { color: '#22aa66', name: 'Copy' });
		importText = file?.text ?? null;
		expect(await succeeded(CHANNELS.calendars.import, { calendarId: copy.id })).toEqual({ created: 3, skipped: 0, status: 'imported', updated: 0 });

		expect(await shown(String(copy.id))).toEqual(await shown(source));
		expect((await shown(source)).length).toBe(6);
	});

	test('importing into the calendar it came from updates instead of duplicating', async () => {
		const source = seededCalendarId();
		await seedEvents(source);
		await invoke(CHANNELS.calendars.export, { calendarId: source });
		const before = await shown(source);

		importText = written[0]?.text ?? null;
		expect(await succeeded(CHANNELS.calendars.import, { calendarId: source })).toEqual({ created: 0, skipped: 0, status: 'imported', updated: 3 });
		expect(await shown(source)).toEqual(before);
	});

	test('an invalid file shows an error and writes nothing', async () => {
		const changes: string[] = [];
		resetup(undefined, { eventsChanged: () => changes.push('changed') });
		const before = rows('SELECT * FROM events');
		importText = 'this is not a calendar';

		expect(await invoke(CHANNELS.calendars.import, { calendarId: seededCalendarId() })).toMatchObject({ error: { issues: [{ key: 'ical.invalidFile' }] }, ok: false });
		expect(rows('SELECT * FROM events')).toEqual(before);
		expect(changes).toEqual([]);
	});

	test('a failure while writing rolls back the whole import', async () => {
		resetup(deps => ({
			events: {
				...deps.events,
				save: (() => {
					let calls = 0;
					return (event: Parameters<typeof deps.events.save>[0]) => (++calls === 2 ? Promise.reject(new Error('disk I/O error')) : deps.events.save(event));
				})(),
			},
		}));
		importText = [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//Test//EN',
			...['a', 'b'].flatMap(uid => ['BEGIN:VEVENT', `UID:${uid}`, 'DTSTART:20261120T140000Z', 'DTEND:20261120T150000Z', `SUMMARY:${uid}`, 'END:VEVENT']),
			'END:VCALENDAR',
		].join('\r\n');

		expect(await invoke(CHANNELS.calendars.import, { calendarId: seededCalendarId() })).toMatchObject({ ok: false });
		expect(rows('SELECT id FROM events')).toEqual([]);
	});

	test('canceling a dialog changes nothing', async () => {
		exportPath = null;
		expect(await succeeded(CHANNELS.calendars.import, { calendarId: seededCalendarId() })).toEqual({ status: 'canceled' });
		expect(await succeeded(CHANNELS.calendars.export, { calendarId: null })).toEqual({ status: 'canceled' });
		expect(written).toEqual([]);
	});

	test('exporting every calendar names the file after the app', async () => {
		await invoke(CHANNELS.calendars.export, { calendarId: null });
		expect(written[0]?.path).toBe('/exports/Tempi.ics');
	});
});

describe('backup and restore', () => {
	beforeEach(() => setup());

	test('backs up to the chosen path, named with the date', async () => {
		expect(await invoke(CHANNELS.data.backup)).toEqual({ ok: true, value: { status: 'saved' } });
		expect(dataCalls).toEqual(['backup /backups/Tempi backup 2026-11-15.db']);
	});

	test('restores the chosen file, then reports the restart', async () => {
		restoreSource = '/backups/tempi.db';
		expect(await invoke(CHANNELS.data.restore)).toEqual({ ok: true, value: { status: 'restarting' } });
		expect(dataCalls).toEqual(['restore /backups/tempi.db']);
	});

	test('reports an invalid backup as an error', async () => {
		restoreSource = '/downloads/photo.png';
		expect(await invoke(CHANNELS.data.restore)).toMatchObject({ error: { issues: [{ key: 'backup.invalidFile' }] }, ok: false });
	});

	test('canceling a dialog does nothing', async () => {
		backupPath = null;
		expect(await invoke(CHANNELS.data.backup)).toEqual({ ok: true, value: { status: 'canceled' } });
		expect(await invoke(CHANNELS.data.restore)).toEqual({ ok: true, value: { status: 'canceled' } });
		expect(dataCalls).toEqual([]);
	});
});

describe('Google account', () => {
	beforeEach(() => setup());

	test('connects one account, refuses a second and disconnects', async () => {
		expect(await invoke(CHANNELS.google.account)).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.google.connect)).toEqual({ ok: true, value: { account: { email: 'ada@example.com' }, status: 'connected' } });
		expect(await invoke(CHANNELS.google.connect)).toMatchObject({ error: { issues: [{ key: 'google.alreadyConnected' }] }, ok: false });
		expect(await invoke(CHANNELS.google.account)).toEqual({ ok: true, value: { email: 'ada@example.com' } });
		expect(await invoke(CHANNELS.google.disconnect)).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.google.account)).toEqual({ ok: true, value: null });
	});

	test('refuses untrusted senders', async () => {
		expect(await invoke(CHANNELS.google.connect, undefined, 'https://evil.example/')).toMatchObject({ ok: false });
		expect(googleEmail).toBeNull();
	});

	test('connecting starts sync; disconnecting stops it first, then removes Google calendars and their events', async () => {
		await invoke(CHANNELS.google.connect);
		expect(syncCalls).toEqual(['start', 'syncNow']);
		db.prepare("INSERT INTO calendars (id, name, color, source, is_default, is_visible, read_only, created_at, updated_at) VALUES ('gcal', 'Ada', '#0b8043', 'google', 0, 1, 0, :t, :t)").run({
			t: T0,
		});
		db.prepare(
			"INSERT INTO google_calendars (google_id, calendar_id, name, color, access_role, is_primary, time_zone, selected) VALUES ('ada@example.com', 'gcal', 'Ada', '#0b8043', 'owner', 1, 'UTC', 1)"
		).run();
		expect(await invoke(CHANNELS.calendars.list)).toMatchObject({ value: [{}, { id: 'gcal', source: 'google' }] });

		expect(await invoke(CHANNELS.google.disconnect)).toEqual({ ok: true, value: null });
		expect(syncCalls).toEqual(['start', 'syncNow', 'stop']);
		expect(await invoke(CHANNELS.calendars.list)).toMatchObject({ value: [{ source: 'local' }] });
		expect(rows('SELECT * FROM google_calendars')).toEqual([]);
	});

	test('choosing calendars and Sync now trigger a sync', async () => {
		db.prepare("INSERT INTO google_calendars (google_id, name, color, access_role, is_primary, time_zone, selected) VALUES ('team@example.com', 'Team', '#0b8043', 'writer', 0, 'UTC', 0)").run();
		expect(await invoke(CHANNELS.google.selectCalendars, { googleIds: ['team@example.com'] })).toMatchObject({ ok: true, value: [{ googleId: 'team@example.com', selected: true }] });
		expect(await invoke(CHANNELS.google.sync)).toEqual({ ok: true, value: { ...IDLE, lastSyncedAt: T0 } });
		expect(syncCalls).toEqual(['syncNow', 'syncNow']);
		expect(await invoke(CHANNELS.google.syncStatus)).toEqual({ ok: true, value: IDLE });
	});
});

describe('updates', () => {
	beforeEach(() => setup());

	test('answers the status, then a check that finds a newer release', async () => {
		expect(await invoke(CHANNELS.updates.status)).toMatchObject({ ok: true, value: { currentVersion: '0.1.0', state: 'idle' } });
		expect(await invoke(CHANNELS.updates.check)).toMatchObject({ ok: true, value: { latestVersion: '0.2.0', state: 'available' } });
	});

	test('install does nothing when no update is downloaded', async () => {
		expect(await invoke(CHANNELS.updates.install)).toEqual({ ok: true, value: null });
	});

	test('refuses untrusted senders', async () => {
		expect(await invoke(CHANNELS.updates.check, undefined, 'https://evil.example/')).toMatchObject({ ok: false });
	});
});

describe('permissions', () => {
	beforeEach(() => setup());

	test('answers the OS status', async () => {
		expect(await invoke(CHANNELS.permissions.status)).toEqual({
			ok: true,
			value: { microphone: { canOpenSettings: true, state: 'denied' }, notifications: { canOpenSettings: true, state: 'unknown' } },
		});
	});

	test('opens only a known permission’s page, and fails where there is none', async () => {
		expect(await invoke(CHANNELS.permissions.openSystemSettings, 'microphone')).toEqual({ ok: true, value: null });
		expect(await invoke(CHANNELS.permissions.openSystemSettings, 'notifications')).toMatchObject({ ok: false });
		expect(await invoke(CHANNELS.permissions.openSystemSettings, 'https://evil.example/')).toMatchObject({ error: { code: 'validation' }, ok: false });
		expect(permissionCalls).toEqual(['open microphone', 'open notifications']);
	});

	test('shows a test notification', async () => {
		expect(await invoke(CHANNELS.permissions.testNotification)).toEqual({ ok: true, value: null });
		expect(permissionCalls).toEqual(['notify']);
	});

	test('reports a test notification the OS refused, with its reason for developers', async () => {
		notificationRefusal = 'Notifications are not allowed for this application';
		expect(await invoke(CHANNELS.permissions.testNotification)).toEqual({
			error: {
				code: 'internal',
				issues: [{ detail: 'The OS refused the test notification: Notifications are not allowed for this application', key: 'notifications.failed' }],
			},
			ok: false,
		});
	});

	test('refuses untrusted senders', async () => {
		expect(await invoke(CHANNELS.permissions.testNotification, undefined, 'https://evil.example/')).toMatchObject({ ok: false });
		expect(permissionCalls).toEqual([]);
	});
});
