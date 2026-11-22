import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DatabaseSync } from 'node:sqlite';
import { type CalendarEvent, createEvent, deleteEvent, deleteOccurrence, listEvents, ok, updateEvent, updateOccurrence, uuidv7Ids } from '@tempi/core';
import { createRepositories, createTransactionQueue, openDatabase } from '@tempi/db';
import { type SyncDeps, syncGoogle } from './sync';
import { FakeGoogle } from './test-fakes';

const PRIMARY = 'ada@example.com';
const HOLIDAYS = 'holidays#google';

let now = '2026-11-16T10:00:00.000Z';
const clock = { now: () => new Date(now) };
/** Moves the local clock, so local edits are newer (or older) than Google's. */
const at = (iso: string) => {
	now = iso;
};

let db: DatabaseSync;
let deps: SyncDeps;
let google: FakeGoogle;

const sync = () => {
	const queue = createTransactionQueue(db);
	return syncGoogle({
		api: google.client,
		transact: async work => {
			const result = await queue(async () => ok(await work(deps)));
			if (!result.ok) throw new Error(result.error.issues[0]?.detail);
			return result.value;
		},
	});
};

const calendarIdOf = async (googleId: string): Promise<string> => {
	const link = (await deps.googleSync.listCalendars()).find(candidate => candidate.googleId === googleId);
	if (link?.calendarId == null) throw new Error(`${googleId} has no local calendar`);
	return link.calendarId;
};

const localEvents = async (googleId: string): Promise<CalendarEvent[]> => deps.events.listByCalendar(await calendarIdOf(googleId));

const titles = async (googleId: string) => (await localEvents(googleId)).map(event => event.title).sort();

const range = { end: '2026-12-31T00:00:00.000Z', start: '2026-11-01T00:00:00.000Z' };

const timed = (id: string, summary: string, start: string, end: string) => ({
	end: { dateTime: end, timeZone: 'America/Lima' },
	id,
	start: { dateTime: start, timeZone: 'America/Lima' },
	status: 'confirmed',
	summary,
});

beforeEach(() => {
	now = '2026-11-16T10:00:00.000Z';
	db = openDatabase(':memory:', { clock });
	deps = { ...createRepositories(db), clock, ids: uuidv7Ids };
	google = new FakeGoogle();
	google.addCalendar({ accessRole: 'owner', backgroundColor: '#0B8043', id: PRIMARY, primary: true, summary: 'Ada', timeZone: 'America/Lima' });
	google.addCalendar({ accessRole: 'reader', backgroundColor: '#9E69AF', id: HOLIDAYS, summary: 'Holidays', timeZone: 'America/Lima' });
});

afterEach(() => db.close());

describe('calendars', () => {
	test('the first sync selects the primary calendar and creates it with its color; others are offered', async () => {
		await sync();
		const calendar = await deps.calendars.findById(await calendarIdOf(PRIMARY));
		expect(calendar).toMatchObject({ color: '#0b8043', name: 'Ada', readOnly: false, source: 'google' });
		expect((await deps.googleSync.listCalendars()).map(link => [link.googleId, link.selected])).toEqual([
			[PRIMARY, true],
			[HOLIDAYS, false],
		]);
	});

	test('a read-only calendar syncs from Google only', async () => {
		await sync();
		await deps.googleSync.saveCalendar({ ...(await deps.googleSync.listCalendars()).find(link => link.googleId === HOLIDAYS)!, selected: true }); // listed just above
		google.put(HOLIDAYS, { end: { date: '2026-12-26' }, id: 'xmas', start: { date: '2026-12-25' }, status: 'confirmed', summary: 'Christmas' });
		await sync();
		const [christmas] = await localEvents(HOLIDAYS);
		expect(christmas).toMatchObject({ allDay: true, endAt: '2026-12-26T05:00:00.000Z', startAt: '2026-12-25T05:00:00.000Z', title: 'Christmas' });
		expect((await deps.calendars.findById(await calendarIdOf(HOLIDAYS)))?.readOnly).toBe(true);
	});

	test('a calendar removed from the account leaves Tempi', async () => {
		google.put(PRIMARY, timed('a', 'Standup', '2026-11-20T09:00:00-05:00', '2026-11-20T09:30:00-05:00'));
		await sync();
		const calendarId = await calendarIdOf(PRIMARY);
		google.calendars = google.calendars.filter(entry => entry.id !== PRIMARY);
		await sync();
		expect((await deps.calendars.findById(calendarId))?.deletedAt).not.toBeNull();
		expect(await deps.events.listByCalendar(calendarId)).toEqual([]);
		expect(await deps.googleSync.listCalendars()).toHaveLength(1);
	});
});

describe('pull', () => {
	test('brings Google events into Tempi, then only what changed', async () => {
		google.put(PRIMARY, timed('a', 'Standup', '2026-11-20T09:00:00-05:00', '2026-11-20T09:30:00-05:00'));
		google.put(PRIMARY, { ...timed('b', 'Lunch', '2026-11-20T12:00:00-05:00', '2026-11-20T13:00:00-05:00'), reminders: { overrides: [{ method: 'popup', minutes: 15 }], useDefault: false } });
		expect(await sync()).toEqual({ pulled: 2, pushed: 0, skipped: 0 });
		expect(await localEvents(PRIMARY)).toMatchObject([
			{ endAt: '2026-11-20T14:30:00.000Z', reminderMinutes: null, startAt: '2026-11-20T14:00:00.000Z', timeZone: 'America/Lima', title: 'Standup' },
			{ reminderMinutes: 15, title: 'Lunch' },
		]);

		google.put(PRIMARY, timed('a', 'Daily standup', '2026-11-20T09:00:00-05:00', '2026-11-20T09:30:00-05:00'));
		google.client.events.delete(PRIMARY, 'b');
		expect(await sync()).toEqual({ pulled: 2, pushed: 0, skipped: 0 });
		expect(await titles(PRIMARY)).toEqual(['Daily standup']);
		expect(await sync()).toEqual({ pulled: 0, pushed: 0, skipped: 0 });
	});

	test('an expired sync token triggers a full pull that drops what Google no longer has', async () => {
		google.put(PRIMARY, timed('a', 'Standup', '2026-11-20T09:00:00-05:00', '2026-11-20T09:30:00-05:00'));
		google.put(PRIMARY, timed('b', 'Lunch', '2026-11-20T12:00:00-05:00', '2026-11-20T13:00:00-05:00'));
		await sync();
		google.events.get(PRIMARY)?.delete('b');
		google.expiredBefore = Number.POSITIVE_INFINITY;
		await sync();
		expect(await titles(PRIMARY)).toEqual(['Standup']);
	});

	test('a recurring event comes with its rule, skipped dates and edited occurrences', async () => {
		google.put(PRIMARY, {
			...timed('weekly', 'Review', '2026-11-20T09:00:00-05:00', '2026-11-20T10:00:00-05:00'),
			recurrence: ['RRULE:FREQ=WEEKLY;COUNT=5', 'EXDATE;TZID=America/Lima:20261127T090000'],
		});
		google.put(PRIMARY, {
			...timed('weekly_20261204T140000Z', 'Review (moved)', '2026-12-04T11:00:00-05:00', '2026-12-04T12:00:00-05:00'),
			originalStartTime: { dateTime: '2026-12-04T09:00:00-05:00' },
			recurringEventId: 'weekly',
		});
		google.put(PRIMARY, { id: 'weekly_20261211T140000Z', originalStartTime: { dateTime: '2026-12-11T09:00:00-05:00' }, recurringEventId: 'weekly', status: 'cancelled' } as never);
		await sync();

		const occurrences = await listEvents(deps, range);
		expect(occurrences.ok && occurrences.value.map(event => [event.title, event.startAt])).toEqual([
			['Review', '2026-11-20T14:00:00.000Z'],
			['Review (moved)', '2026-12-04T16:00:00.000Z'],
			['Review', '2026-12-18T14:00:00.000Z'],
		]);
	});
});

describe('push', () => {
	test('local creates, updates and deletes reach Google, and their echoes change nothing', async () => {
		await sync();
		const calendarId = await calendarIdOf(PRIMARY);
		const created = await createEvent(deps, {
			calendarId,
			endAt: '2026-11-21T15:00:00Z',
			reminderMinutes: 10,
			startAt: '2026-11-21T14:00:00Z',
			timeZone: 'America/Lima',
			title: 'Dentist',
			videoUrl: 'https://meet.example/x',
		});
		if (!created.ok) throw new Error('create failed');
		expect(await sync()).toMatchObject({ pushed: 1 });
		expect(google.live(PRIMARY)).toMatchObject([
			{
				extendedProperties: { private: { tempiVideoUrl: 'https://meet.example/x' } },
				reminders: { overrides: [{ minutes: 10 }] },
				start: { dateTime: '2026-11-21T14:00:00.000Z', timeZone: 'America/Lima' },
				summary: 'Dentist',
			},
		]);
		expect(await sync()).toEqual({ pulled: 0, pushed: 0, skipped: 0 });

		at('2026-11-17T10:00:00.000Z');
		await updateEvent(deps, created.value.id, { title: 'Dentist (Dr. Ruiz)' });
		await sync();
		expect(google.live(PRIMARY).map(event => event.summary)).toEqual(['Dentist (Dr. Ruiz)']);

		at('2026-11-18T10:00:00.000Z');
		await deleteEvent(deps, created.value.id);
		await sync();
		expect(google.live(PRIMARY)).toEqual([]);
		expect(await sync()).toEqual({ pulled: 0, pushed: 0, skipped: 0 });
	});

	test('offline edits stay pending and sync once Google is reachable', async () => {
		await sync();
		const created = await createEvent(deps, { calendarId: await calendarIdOf(PRIMARY), endAt: '2026-11-21T15:00:00Z', startAt: '2026-11-21T14:00:00Z', timeZone: 'UTC', title: 'Offline idea' });
		expect(created.ok).toBe(true);
		google.offline = true;
		await expect(sync()).rejects.toThrow('offline');
		google.offline = false;
		expect(await sync()).toMatchObject({ pushed: 1 });
		expect(google.live(PRIMARY).map(event => event.summary)).toEqual(['Offline idea']);
	});

	test('an event moved to a local calendar is deleted from Google', async () => {
		const local = (await deps.calendars.list())[0];
		await sync();
		const created = await createEvent(deps, { calendarId: await calendarIdOf(PRIMARY), endAt: '2026-11-21T15:00:00Z', startAt: '2026-11-21T14:00:00Z', timeZone: 'UTC', title: 'Private' });
		if (!created.ok || local === undefined) throw new Error('setup failed');
		await sync();
		at('2026-11-17T10:00:00.000Z');
		await updateEvent(deps, created.value.id, { calendarId: local.id });
		await sync();
		expect(google.live(PRIMARY)).toEqual([]);
		expect((await deps.events.findById(created.value.id))?.deletedAt).toBeNull();
	});
});

describe('conflicts', () => {
	test('the latest change wins, whichever side made it', async () => {
		google.put(PRIMARY, timed('a', 'Standup', '2026-11-20T09:00:00-05:00', '2026-11-20T09:30:00-05:00'));
		await sync();
		const [standup] = await localEvents(PRIMARY);
		if (standup === undefined) throw new Error('not pulled');

		// Local edit after Google's: local wins and is pushed.
		google.put(PRIMARY, timed('a', 'Google title', '2026-11-20T09:00:00-05:00', '2026-11-20T09:30:00-05:00'));
		at('2026-11-17T00:00:00.000Z');
		await updateEvent(deps, standup.id, { title: 'Local title' });
		await sync();
		expect(google.get(PRIMARY, 'a')?.summary).toBe('Local title');
		expect((await deps.events.findById(standup.id))?.title).toBe('Local title');

		// Local edit before Google's: Google wins.
		at('2026-11-16T08:00:00.000Z');
		await updateEvent(deps, standup.id, { title: 'Older local title' });
		google.put(PRIMARY, timed('a', 'Newer Google title', '2026-11-20T09:00:00-05:00', '2026-11-20T09:30:00-05:00'));
		await sync();
		expect((await deps.events.findById(standup.id))?.title).toBe('Newer Google title');
		expect(google.get(PRIMARY, 'a')?.summary).toBe('Newer Google title');
	});

	test('a deletion on Google loses to a later local edit, which restores the event there', async () => {
		google.put(PRIMARY, timed('a', 'Standup', '2026-11-20T09:00:00-05:00', '2026-11-20T09:30:00-05:00'));
		await sync();
		const [standup] = await localEvents(PRIMARY);
		if (standup === undefined) throw new Error('not pulled');
		google.client.events.delete(PRIMARY, 'a');
		at('2026-11-18T00:00:00.000Z');
		await updateEvent(deps, standup.id, { title: 'Still on' });
		await sync();
		expect(google.get(PRIMARY, 'a')).toMatchObject({ status: 'confirmed', summary: 'Still on' });
	});
});

describe('recurring events round-trip', () => {
	test('a local series with an edited and a deleted occurrence arrives intact in another Tempi', async () => {
		await sync();
		const created = await createEvent(deps, {
			calendarId: await calendarIdOf(PRIMARY),
			endAt: '2026-11-20T15:00:00Z',
			rrule: 'FREQ=WEEKLY;COUNT=4',
			startAt: '2026-11-20T14:00:00Z',
			timeZone: 'America/Lima',
			title: 'Review',
		});
		if (!created.ok) throw new Error('create failed');
		at('2026-11-16T11:00:00.000Z');
		await updateOccurrence(
			deps,
			{ originalStartAt: '2026-11-27T14:00:00.000Z', scope: 'this', seriesId: created.value.id },
			{ endAt: '2026-11-27T17:00:00Z', startAt: '2026-11-27T16:00:00Z', title: 'Review (moved)' }
		);
		await deleteOccurrence(deps, { originalStartAt: '2026-12-04T14:00:00.000Z', scope: 'this', seriesId: created.value.id });
		await sync();

		const master = google.live(PRIMARY).find(event => event.recurrence !== undefined);
		expect(master?.recurrence).toEqual(['RRULE:FREQ=WEEKLY;COUNT=4', 'EXDATE:20261204T140000Z']);
		expect(google.live(PRIMARY).find(event => event.recurringEventId !== undefined)).toMatchObject({ id: `${master?.id}_20261127T140000Z`, summary: 'Review (moved)' });

		const before = await listEvents(deps, range);
		// A second computer: a fresh database pulls the same account.
		db.close();
		db = openDatabase(':memory:', { clock });
		deps = { ...createRepositories(db), clock, ids: uuidv7Ids };
		await sync();
		const after = await listEvents(deps, range);
		const shape = (result: typeof before) => (result.ok ? result.value.map(event => [event.title, event.startAt, event.endAt]) : []);
		expect(shape(after)).toEqual(shape(before));
		expect(shape(after)).toEqual([
			['Review', '2026-11-20T14:00:00.000Z', '2026-11-20T15:00:00.000Z'],
			['Review (moved)', '2026-11-27T16:00:00.000Z', '2026-11-27T17:00:00.000Z'],
			['Review', '2026-12-11T14:00:00.000Z', '2026-12-11T15:00:00.000Z'],
		]);
	});

	test('an all-day series keeps its dates', async () => {
		await sync();
		const created = await createEvent(deps, {
			allDay: true,
			calendarId: await calendarIdOf(PRIMARY),
			endAt: '2026-11-21T05:00:00Z',
			rrule: 'FREQ=DAILY;COUNT=3',
			startAt: '2026-11-20T05:00:00Z',
			timeZone: 'America/Lima',
			title: 'Trip',
		});
		if (!created.ok) throw new Error('create failed');
		await deleteOccurrence(deps, { originalStartAt: '2026-11-21T05:00:00.000Z', scope: 'this', seriesId: created.value.id });
		await sync();
		expect(google.live(PRIMARY)[0]).toMatchObject({ end: { date: '2026-11-21' }, recurrence: ['RRULE:FREQ=DAILY;COUNT=3', 'EXDATE;VALUE=DATE:20261121'], start: { date: '2026-11-20' } });
	});
});
