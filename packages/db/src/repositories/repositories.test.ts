import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { type Calendar, type CalendarEvent, createCalendar, createEvent, DEFAULT_SETTINGS, deleteCalendar, listEvents, saveProfile, saveSettings, type UserProfile } from '@tempi/core';
import { createRepositories, loadMigrations, migrate, type SqliteRepositories } from '../index';
import { openDatabase } from '../open-database';

const T0 = '2026-11-15T10:00:00.000Z';
const clock = { now: () => new Date(T0) };

let db: DatabaseSync;
let repos: SqliteRepositories;

beforeEach(() => {
	db = openDatabase(':memory:', { clock });
	repos = createRepositories(db);
});

afterEach(() => db.close());

const makeCalendar = (overrides: Partial<Calendar> = {}): Calendar => ({
	color: '#ff0000',
	createdAt: T0,
	deletedAt: null,
	id: 'cal-1',
	isDefault: false,
	isVisible: true,
	name: 'Work',
	readOnly: false,
	source: 'local',
	updatedAt: T0,
	...overrides,
});

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
	allDay: false,
	calendarId: 'cal-1',
	createdAt: T0,
	deletedAt: null,
	description: null,
	endAt: '2026-11-20T10:00:00.000Z',
	exDates: [],
	icalUid: null,
	id: 'evt-1',
	location: null,
	originalStartAt: null,
	recurringEventId: null,
	reminderMinutes: null,
	rrule: null,
	startAt: '2026-11-20T09:00:00.000Z',
	status: 'confirmed',
	timeZone: 'America/Lima',
	title: 'Standup',
	updatedAt: T0,
	videoUrl: null,
	...overrides,
});

const rawRow = (table: 'calendars' | 'events', id: string) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);

describe('SqliteCalendarRepository', () => {
	test('round-trips a calendar and updates it in place', async () => {
		await repos.calendars.save(makeCalendar());
		await repos.calendars.save(makeCalendar({ isVisible: false, name: 'Office' }));
		expect(await repos.calendars.findById('cal-1')).toEqual(makeCalendar({ isVisible: false, name: 'Office' }));
	});

	test('excludes soft-deleted calendars from list but still finds them by id', async () => {
		await repos.calendars.save(makeCalendar({ deletedAt: T0 }));
		expect((await repos.calendars.list()).map(calendar => calendar.id)).not.toContain('cal-1');
		expect(await repos.calendars.findById('cal-1')).toMatchObject({ deletedAt: T0 });
	});

	test('returns null for an unknown id', async () => {
		expect(await repos.calendars.findById('nope')).toBeNull();
	});
});

describe('SqliteEventRepository', () => {
	beforeEach(() => repos.calendars.save(makeCalendar()));

	test('round-trips every field', async () => {
		const event = makeEvent({ allDay: true, description: 'Daily', location: 'Room 1', reminderMinutes: 10, rrule: 'FREQ=DAILY', status: 'tentative', videoUrl: 'https://meet.example/x' });
		await repos.events.save(event);
		expect(await repos.events.findById('evt-1')).toEqual(event);
	});

	test('stores every instant as UTC, whatever offset it arrives with', async () => {
		await repos.events.save(
			makeEvent({
				createdAt: '2026-11-15T05:00:00-05:00',
				deletedAt: '2026-11-15T06:00:00-05:00',
				endAt: '2026-11-20T05:00:00-05:00',
				startAt: '2026-11-20T04:00:00-05:00',
				updatedAt: '2026-11-15T05:00:00-05:00',
			})
		);
		expect(rawRow('events', 'evt-1')).toMatchObject({
			created_at: '2026-11-15T10:00:00.000Z',
			deleted_at: '2026-11-15T11:00:00.000Z',
			end_at: '2026-11-20T10:00:00.000Z',
			start_at: '2026-11-20T09:00:00.000Z',
			updated_at: '2026-11-15T10:00:00.000Z',
		});
	});

	test('lists events overlapping a half-open range, ordered by start', async () => {
		await repos.events.save(makeEvent({ endAt: '2026-11-20T08:00:00.000Z', id: 'ends-at-start', startAt: '2026-11-20T07:00:00.000Z' }));
		await repos.events.save(makeEvent({ endAt: '2026-11-20T09:30:00.000Z', id: 'straddles-start', startAt: '2026-11-20T07:30:00.000Z' }));
		await repos.events.save(makeEvent({ endAt: '2026-11-20T11:00:00.000Z', id: 'inside', startAt: '2026-11-20T10:00:00.000Z' }));
		await repos.events.save(makeEvent({ endAt: '2026-11-20T13:00:00.000Z', id: 'starts-at-end', startAt: '2026-11-20T12:00:00.000Z' }));

		const listed = await repos.events.listInRange({ end: '2026-11-20T12:00:00.000Z', start: '2026-11-20T08:00:00.000Z' });
		expect(listed.map(event => event.id)).toEqual(['straddles-start', 'inside']);
	});

	test('round-trips a series and an edited occurrence linked to it', async () => {
		const series = makeEvent({ exDates: ['2026-11-21T09:00:00.000Z'], id: 'series', rrule: 'FREQ=DAILY' });
		const edited = makeEvent({ endAt: '2026-11-21T11:00:00.000Z', id: 'edited', originalStartAt: '2026-11-21T09:00:00.000Z', recurringEventId: 'series', startAt: '2026-11-21T10:00:00.000Z' });
		await repos.events.save(series);
		await repos.events.save(edited);
		expect(await repos.events.findById('series')).toEqual(series);
		expect(await repos.events.listBySeries('series')).toEqual([edited]);
	});

	test('lists series by start and leaves them out of range reads', async () => {
		await repos.events.save(makeEvent({ id: 'series', rrule: 'FREQ=DAILY' }));
		await repos.events.save(makeEvent({ id: 'later-series', rrule: 'FREQ=DAILY', startAt: '2026-12-01T09:00:00.000Z', endAt: '2026-12-01T10:00:00.000Z' }));
		await repos.events.save(makeEvent({ deletedAt: T0, id: 'deleted-series', rrule: 'FREQ=DAILY' }));
		await repos.events.save(makeEvent({ id: 'single' }));

		expect((await repos.events.listSeries('2026-11-25T00:00:00.000Z')).map(event => event.id)).toEqual(['series']);
		expect((await repos.events.listInRange({ end: '2026-11-21T00:00:00.000Z', start: '2026-11-20T00:00:00.000Z' })).map(event => event.id)).toEqual(['single']);
	});

	test('excludes soft-deleted events from range reads', async () => {
		await repos.events.save(makeEvent({ deletedAt: T0 }));
		expect(await repos.events.listInRange({ end: '2026-11-21T00:00:00.000Z', start: '2026-11-20T00:00:00.000Z' })).toEqual([]);
	});

	test('soft-deletes only the live events of one calendar', async () => {
		const later = '2026-11-16T10:00:00.000Z';
		await repos.calendars.save(makeCalendar({ id: 'cal-2' }));
		await repos.events.save(makeEvent({ id: 'live' }));
		await repos.events.save(makeEvent({ deletedAt: T0, id: 'already-deleted' }));
		await repos.events.save(makeEvent({ calendarId: 'cal-2', id: 'other-calendar' }));

		await repos.events.softDeleteByCalendar('cal-1', later);

		expect(await repos.events.findById('live')).toMatchObject({ deletedAt: later, updatedAt: later });
		expect(await repos.events.findById('already-deleted')).toMatchObject({ deletedAt: T0, updatedAt: T0 });
		expect(await repos.events.findById('other-calendar')).toMatchObject({ deletedAt: null });
	});

	test('moves only the live events of one calendar to another', async () => {
		const later = '2026-11-16T10:00:00.000Z';
		await repos.calendars.save(makeCalendar({ id: 'cal-2' }));
		await repos.events.save(makeEvent({ id: 'live' }));
		await repos.events.save(makeEvent({ deletedAt: T0, id: 'already-deleted' }));

		await repos.events.moveToCalendar('cal-1', 'cal-2', later);

		expect(await repos.events.findById('live')).toMatchObject({ calendarId: 'cal-2', updatedAt: later });
		expect(await repos.events.findById('already-deleted')).toMatchObject({ calendarId: 'cal-1', updatedAt: T0 });
	});

	test('rejects an event whose calendar does not exist', async () => {
		await expect(repos.events.save(makeEvent({ calendarId: 'missing' }))).rejects.toThrow();
	});

	test('rejects a corrupt row instead of returning it', async () => {
		db.prepare(
			"INSERT INTO events (id, calendar_id, title, start_at, end_at, all_day, time_zone, status, created_at, updated_at) VALUES ('bad', 'cal-1', 'x', '2026-11-20T09:00:00.000Z', '2026-11-20T10:00:00.000Z', 0, 'UTC', 'cancelled', ?, ?)"
		).run(T0, T0);
		await expect(repos.events.findById('bad')).rejects.toThrow('Invalid row');
	});
});

describe('SqliteEventRepository by UID and calendar', () => {
	beforeEach(async () => {
		await repos.calendars.save(makeCalendar());
		await repos.calendars.save(makeCalendar({ id: 'cal-2', name: 'Home' }));
	});

	test('finds an imported event by its UID, and a Tempi event by its id, within one calendar', async () => {
		await repos.events.save(makeEvent({ icalUid: 'abc@google.com', id: 'imported' }));
		await repos.events.save(makeEvent({ id: 'native' }));
		await repos.events.save(makeEvent({ calendarId: 'cal-2', icalUid: 'other@example.com', id: 'elsewhere' }));

		expect((await repos.events.findByUid('cal-1', 'abc@google.com'))?.id).toBe('imported');
		expect((await repos.events.findByUid('cal-1', 'native'))?.id).toBe('native');
		expect(await repos.events.findByUid('cal-1', 'other@example.com')).toBeNull();
		expect(await repos.events.findByUid('cal-1', 'imported')).toBeNull();
	});

	test('skips deleted events and edited occurrences', async () => {
		await repos.events.save(makeEvent({ deletedAt: T0, icalUid: 'gone', id: 'gone' }));
		await repos.events.save(makeEvent({ icalUid: 'series', id: 'series', rrule: 'FREQ=DAILY' }));
		await repos.events.save(makeEvent({ icalUid: 'series', id: 'edited', originalStartAt: '2026-11-21T09:00:00.000Z', recurringEventId: 'series' }));

		expect(await repos.events.findByUid('cal-1', 'gone')).toBeNull();
		expect((await repos.events.findByUid('cal-1', 'series'))?.id).toBe('series');
	});

	test('lists every live event of a calendar by start', async () => {
		await repos.events.save(makeEvent({ id: 'late', startAt: '2026-11-20T09:30:00.000Z' }));
		await repos.events.save(makeEvent({ id: 'early', rrule: 'FREQ=WEEKLY' }));
		await repos.events.save(makeEvent({ deletedAt: T0, id: 'gone' }));
		await repos.events.save(makeEvent({ calendarId: 'cal-2', id: 'home' }));

		expect((await repos.events.listByCalendar('cal-1')).map(event => event.id)).toEqual(['early', 'late']);
	});
});

describe('SqliteEventRepository.search', () => {
	beforeEach(() => repos.calendars.save(makeCalendar()));

	const titles = async (text: string, limit = 50) => (await repos.events.search(text, limit)).map(event => event.title);

	test('matches title, location and description by word prefix, ignoring case and accents', async () => {
		await repos.events.save(makeEvent({ id: 'title', title: 'Reunión de equipo' }));
		await repos.events.save(makeEvent({ id: 'location', location: 'Café Central', title: 'Breakfast' }));
		await repos.events.save(makeEvent({ description: 'Bring the ÑANDÚ slides', id: 'description', title: 'Review' }));

		expect(await titles('REUNION')).toEqual(['Reunión de equipo']);
		expect(await titles('cafe')).toEqual(['Breakfast']);
		expect(await titles('nan slid')).toEqual(['Review']);
		expect(await titles('union')).toEqual([]);
	});

	test('follows edits and never returns deleted events', async () => {
		await repos.events.save(makeEvent({ id: 'renamed', title: 'Dentist' }));
		await repos.events.save(makeEvent({ id: 'renamed', title: 'Doctor' }));
		await repos.events.save(makeEvent({ deletedAt: T0, id: 'deleted', title: 'Doctor checkup' }));

		expect(await titles('dentist')).toEqual([]);
		expect(await titles('doctor')).toEqual(['Doctor']);
	});

	test('lists the latest start first, up to the limit', async () => {
		await repos.events.save(makeEvent({ endAt: '2026-11-01T10:00:00.000Z', id: 'early', startAt: '2026-11-01T09:00:00.000Z', title: 'Gym early' }));
		await repos.events.save(makeEvent({ endAt: '2026-11-30T10:00:00.000Z', id: 'late', startAt: '2026-11-30T09:00:00.000Z', title: 'Gym late' }));
		await repos.events.save(makeEvent({ endAt: '2026-11-10T10:00:00.000Z', id: 'middle', startAt: '2026-11-10T09:00:00.000Z', title: 'Gym middle' }));

		expect(await titles('gym', 2)).toEqual(['Gym late', 'Gym middle']);
	});

	test('treats FTS syntax as plain text', async () => {
		await repos.events.save(makeEvent({ title: 'Q&A: "roadmap" - NOT final' }));

		expect(await titles('"roadmap')).toEqual(['Q&A: "roadmap" - NOT final']);
		expect(await titles('not final')).toEqual(['Q&A: "roadmap" - NOT final']);
		expect(await titles('title:roadmap OR x*')).toEqual([]);
		expect(await titles('   ')).toEqual([]);
	});

	test('indexes events saved before the search migration', () => {
		const migrations = loadMigrations();
		const before = new DatabaseSync(':memory:');
		migrate(before, migrations.slice(0, 3));
		before.exec(`INSERT INTO calendars VALUES ('cal-1', 'Work', '#ff0000', 'local', 0, 1, '${T0}', '${T0}', NULL)`);
		before.exec(
			`INSERT INTO events (id, calendar_id, title, start_at, end_at, all_day, time_zone, status, created_at, updated_at) VALUES ('old', 'cal-1', 'Planificación', '${T0}', '${T0}', 0, 'UTC', 'confirmed', '${T0}', '${T0}')`
		);
		migrate(before, migrations);

		expect(before.prepare("SELECT rowid FROM events_search WHERE events_search MATCH 'planificacion'").all()).toHaveLength(1);
		before.close();
	});
});

describe('SqliteGoogleSyncRepository', () => {
	const T1 = '2026-11-16T10:00:00.000Z';
	const calendarLink = {
		accessRole: 'owner',
		calendarId: 'cal-1',
		color: '#0b8043',
		googleId: 'ada@example.com',
		name: 'Ada',
		primary: true,
		selected: true,
		syncToken: 'tok',
		timeZone: 'America/Lima',
	} as const;
	const eventLink = (eventId: string, googleEventId: string) => ({ etag: '"1"', eventId, googleCalendarId: 'ada@example.com', googleEventId, syncedUpdatedAt: T0 });

	beforeEach(() => repos.calendars.save(makeCalendar({ readOnly: true, source: 'google' })));

	test('round-trips calendar links and the read-only flag', async () => {
		await repos.googleSync.saveCalendar(calendarLink);
		await repos.googleSync.saveCalendar({ ...calendarLink, syncToken: 'tok-2' });
		expect(await repos.googleSync.listCalendars()).toEqual([{ ...calendarLink, syncToken: 'tok-2' }]);
		expect((await repos.calendars.findById('cal-1'))?.readOnly).toBe(true);
	});

	test('finds event links by event and by Google id', async () => {
		await repos.events.save(makeEvent());
		await repos.googleSync.saveEventLink(eventLink('evt-1', 'g1'));
		expect(await repos.googleSync.findEventLink('evt-1')).toEqual(eventLink('evt-1', 'g1'));
		expect(await repos.googleSync.findEventLinkByGoogleId('ada@example.com', 'g1')).toEqual(eventLink('evt-1', 'g1'));
		expect(await repos.googleSync.listEventLinks('ada@example.com')).toHaveLength(1);
		await repos.googleSync.deleteEventLink('evt-1');
		expect(await repos.googleSync.findEventLink('evt-1')).toBeNull();
	});

	test('lists changes to push: changed links, deletions, new events in synced calendars, series before exceptions', async () => {
		await repos.calendars.save(makeCalendar({ id: 'local' }));
		await repos.events.save(makeEvent({ id: 'synced' }));
		await repos.events.save(makeEvent({ id: 'edited', updatedAt: T1 }));
		await repos.events.save(makeEvent({ deletedAt: T1, id: 'deleted', updatedAt: T1 }));
		await repos.events.save(makeEvent({ id: 'series', rrule: 'FREQ=WEEKLY', updatedAt: T1 }));
		// Older than the series, yet listed after it: exceptions follow their series.
		await repos.events.save(makeEvent({ id: 'override', originalStartAt: '2026-11-27T09:00:00.000Z', recurringEventId: 'series' }));
		await repos.events.save(makeEvent({ deletedAt: T1, id: 'never-synced', updatedAt: T1 }));
		await repos.events.save(makeEvent({ calendarId: 'local', id: 'local-only' }));
		for (const id of ['synced', 'edited', 'deleted']) await repos.googleSync.saveEventLink(eventLink(id, `g-${id}`));
		expect((await repos.googleSync.listPendingEvents(['cal-1'])).map(event => event.id)).toEqual(['deleted', 'edited', 'series', 'override']);
	});

	test('deleting a calendar or clearing forgets its event links', async () => {
		await repos.events.save(makeEvent());
		await repos.googleSync.saveCalendar(calendarLink);
		await repos.googleSync.saveEventLink(eventLink('evt-1', 'g1'));
		await repos.googleSync.deleteCalendar('ada@example.com');
		expect(await repos.googleSync.listCalendars()).toEqual([]);
		expect(await repos.googleSync.findEventLink('evt-1')).toBeNull();
		await repos.googleSync.saveCalendar(calendarLink);
		await repos.googleSync.saveEventLink(eventLink('evt-1', 'g1'));
		await repos.googleSync.clear();
		expect(await repos.googleSync.listCalendars()).toEqual([]);
		expect(await repos.googleSync.findEventLink('evt-1')).toBeNull();
	});
});

describe('SqliteProfileRepository', () => {
	const profile: UserProfile = { avatar: null, country: 'PE', createdAt: T0, firstName: 'Ada', lastName: 'Lovelace', timeZone: 'America/Lima', updatedAt: T0 };

	test('is empty until saved, then round-trips and updates the single row', async () => {
		expect(await repos.profile.get()).toBeNull();
		await repos.profile.save(profile);
		await repos.profile.save({ ...profile, avatar: 'a.png', updatedAt: '2026-11-16T10:00:00.000Z' });
		expect(await repos.profile.get()).toEqual({ ...profile, avatar: 'a.png', updatedAt: '2026-11-16T10:00:00.000Z' });
		expect(db.prepare('SELECT COUNT(*) AS count FROM profile').get()).toMatchObject({ count: 1 });
	});
});

describe('SqliteSettingsRepository', () => {
	test('is empty until saved, then round-trips and updates the single row', async () => {
		const settings = { ...DEFAULT_SETTINGS, createdAt: T0, updatedAt: T0 };
		expect(await repos.settings.get()).toBeNull();
		await repos.settings.save(settings);
		const changed = {
			...settings,
			allDayCollapsed: true,
			microphoneEnabled: false,
			notificationsEnabled: false,
			showWeekNumbers: true,
			sound: 'pop',
			soundsEnabled: false,
			theme: 'dark',
			tourCompleted: true,
		} as const;
		await repos.settings.save(changed);
		expect(await repos.settings.get()).toEqual(changed);
		expect(db.prepare('SELECT COUNT(*) AS count FROM settings').get()).toMatchObject({ count: 1 });
	});
});

describe('core use cases over SQLite', () => {
	let n = 0;
	const deps = () => ({ ...repos, clock, ids: { next: () => `id-${++n}` } });

	test('create, list and cascade-delete through the ports', async () => {
		const work = await createCalendar(deps(), { color: '#00FF00', name: 'Work' });
		if (!work.ok) throw new Error('calendar not created');
		const event = await createEvent(deps(), { calendarId: work.value.id, endAt: '2026-11-20T10:00:00-05:00', startAt: '2026-11-20T09:00:00-05:00', timeZone: 'America/Lima', title: 'Review' });
		expect(event.ok).toBe(true);

		const range = { end: '2026-11-21T00:00:00.000Z', start: '2026-11-20T00:00:00.000Z' };
		expect(await listEvents(deps(), range)).toMatchObject({ ok: true, value: [{ startAt: '2026-11-20T14:00:00.000Z', title: 'Review' }] });

		expect(await deleteCalendar(deps(), { id: work.value.id, moveEventsTo: null })).toEqual({ ok: true, value: null });
		expect(await listEvents(deps(), range)).toEqual({ ok: true, value: [] });
	});

	test('the seeded calendar is the default and cannot be deleted', async () => {
		const [seeded] = await repos.calendars.list();
		expect(seeded).toMatchObject({ isDefault: true });
		expect(await deleteCalendar(deps(), { id: seeded?.id ?? '', moveEventsTo: null })).toMatchObject({ error: { code: 'conflict' }, ok: false });
	});

	test('profile and settings persist through their use cases', async () => {
		await saveProfile(deps(), { country: 'pe', firstName: 'Ada', lastName: 'Lovelace', timeZone: 'America/Lima' });
		await saveSettings(deps(), { language: 'es' });
		expect(await repos.profile.get()).toMatchObject({ country: 'PE' });
		expect(await repos.settings.get()).toMatchObject({ language: 'es', weekStart: 'monday' });
	});
});
