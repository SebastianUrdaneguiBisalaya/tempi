import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DatabaseSync } from 'node:sqlite';
import { type Calendar, type CalendarEvent, createCalendar, createEvent, DEFAULT_SETTINGS, deleteCalendar, listEvents, saveProfile, saveSettings, type UserProfile } from '@tempi/core';
import { createRepositories, type SqliteRepositories } from '../index';
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
		await repos.settings.save({ ...settings, showWeekNumbers: true, theme: 'dark' });
		expect(await repos.settings.get()).toEqual({ ...settings, showWeekNumbers: true, theme: 'dark' });
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

		expect(await deleteCalendar(deps(), work.value.id)).toEqual({ ok: true, value: null });
		expect(await listEvents(deps(), range)).toEqual({ ok: true, value: [] });
	});

	test('the seeded calendar is the default and cannot be deleted', async () => {
		const [seeded] = await repos.calendars.list();
		expect(seeded).toMatchObject({ isDefault: true });
		expect(await deleteCalendar(deps(), seeded?.id ?? '')).toMatchObject({ error: { code: 'conflict' }, ok: false });
	});

	test('profile and settings persist through their use cases', async () => {
		await saveProfile(deps(), { country: 'pe', firstName: 'Ada', lastName: 'Lovelace', timeZone: 'America/Lima' });
		await saveSettings(deps(), { language: 'es' });
		expect(await repos.profile.get()).toMatchObject({ country: 'PE' });
		expect(await repos.settings.get()).toMatchObject({ language: 'es', weekStart: 'monday' });
	});
});
