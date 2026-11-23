import { describe, expect, test } from 'bun:test';
import type { Calendar } from '../domain/calendar';
import type { CalendarEvent } from '../domain/event';
import { NO_SERIES } from '../domain/event';
import type { GoogleCalendarLink } from '../domain/google-sync';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { deleteCalendar } from './delete-calendar';
import { deleteEvent } from './delete-event';
import { duplicateEvent } from './duplicate-event';
import { disconnectGoogleCalendars, listGoogleCalendars, selectGoogleCalendars } from './google-calendars';
import { deleteOccurrence, updateOccurrence } from './occurrences';
import { failure, makeDeps, T0 } from './test-fakes';
import { updateEvent } from './update-event';

const stamps = { createdAt: T0, deletedAt: null, updatedAt: T0 };

const googleCalendar = (id: string, overrides: Partial<Calendar> = {}): Calendar => ({
	...stamps,
	color: '#0b8043',
	id,
	isDefault: false,
	isVisible: true,
	name: id,
	readOnly: false,
	source: 'google',
	...overrides,
});

const link = (googleId: string, calendarId: string | null, overrides: Partial<GoogleCalendarLink> = {}): GoogleCalendarLink => ({
	accessRole: 'owner',
	calendarId,
	color: '#0b8043',
	googleId,
	name: googleId,
	primary: false,
	selected: calendarId !== null,
	syncToken: calendarId === null ? null : 'token',
	timeZone: 'America/Lima',
	...overrides,
});

const event = (id: string, calendarId: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
	...NO_SERIES,
	...stamps,
	allDay: false,
	googleMeet: false,
	guests: [],
	calendarId,
	description: null,
	endAt: '2026-11-20T15:00:00.000Z',
	id,
	location: null,
	reminderMinutes: null,
	rrule: null,
	startAt: '2026-11-20T14:00:00.000Z',
	status: 'confirmed',
	timeZone: 'America/Lima',
	title: id,
	videoUrl: null,
	...overrides,
});

const setup = async () => {
	const deps = makeDeps();
	const local = await createCalendar(deps, { color: '#3366ff', name: 'Personal' });
	if (!local.ok) throw new Error('setup failed');
	await deps.calendars.save(googleCalendar('work'));
	await deps.calendars.save(googleCalendar('holidays', { readOnly: true }));
	await deps.googleSync.saveCalendar(link('work@example.com', 'work', { primary: true }));
	await deps.googleSync.saveCalendar(link('holidays#google', 'holidays', { accessRole: 'reader', name: 'Holidays' }));
	await deps.googleSync.saveCalendar(link('team@example.com', null, { name: 'Team' }));
	return { deps, localId: local.value.id };
};

describe('read-only calendars', () => {
	test('their events cannot be created, changed, deleted or duplicated', async () => {
		const { deps } = await setup();
		await deps.events.save(event('holiday', 'holidays'));
		const readOnly = { error: { code: 'conflict', issues: [expect.objectContaining({ key: 'calendar.readOnly' })] }, ok: false };
		expect(await createEvent(deps, { calendarId: 'holidays', endAt: '2026-11-20T15:00:00Z', startAt: '2026-11-20T14:00:00Z', timeZone: 'UTC', title: 'x' })).toMatchObject(readOnly);
		expect(await updateEvent(deps, 'holiday', { title: 'Mine now' })).toMatchObject(readOnly);
		expect(await deleteEvent(deps, 'holiday')).toMatchObject(readOnly);
		expect(await duplicateEvent(deps, 'holiday')).toMatchObject(readOnly);
		expect((await deps.events.findById('holiday'))?.title).toBe('holiday');
	});

	test('events cannot move into one, and series in one cannot change', async () => {
		const { deps, localId } = await setup();
		await deps.events.save(event('mine', localId));
		expect(await updateEvent(deps, 'mine', { calendarId: 'holidays' })).toMatchObject(failure('conflict', 'calendarId'));
		await deps.events.save(event('weekly', 'holidays', { rrule: 'FREQ=WEEKLY' }));
		const target = { originalStartAt: '2026-11-27T14:00:00.000Z', scope: 'this' as const, seriesId: 'weekly' };
		expect(await updateOccurrence(deps, target, { title: 'x' })).toMatchObject(failure('conflict'));
		expect(await deleteOccurrence(deps, target)).toMatchObject(failure('conflict'));
	});

	test('a synced calendar cannot be deleted like a local one', async () => {
		const { deps } = await setup();
		expect(await deleteCalendar(deps, { id: 'work', moveEventsTo: null })).toMatchObject({ error: { issues: [expect.objectContaining({ key: 'calendar.synced' })] }, ok: false });
	});
});

describe('Google calendar selection', () => {
	test('lists the primary calendar first, then by name', async () => {
		const { deps } = await setup();
		expect((await listGoogleCalendars(deps)).map(choice => choice.googleId)).toEqual(['work@example.com', 'holidays#google', 'team@example.com']);
	});

	test('unselecting removes the calendar and its events from Tempi and forgets their links', async () => {
		const { deps } = await setup();
		await deps.events.save(event('standup', 'work'));
		await deps.googleSync.saveEventLink({ etag: '"1"', eventId: 'standup', googleCalendarId: 'work@example.com', attendees: [], googleEventId: 'g1', meet: false, syncedUpdatedAt: T0 });
		deps.clock.set('2026-11-16T00:00:00.000Z');

		const choices = await selectGoogleCalendars(deps, { googleIds: ['holidays#google', 'team@example.com'] });
		expect(choices.ok && choices.value.map(choice => [choice.googleId, choice.selected])).toEqual([
			['work@example.com', false],
			['holidays#google', true],
			['team@example.com', true],
		]);
		expect((await deps.calendars.findById('work'))?.deletedAt).toBe('2026-11-16T00:00:00.000Z');
		expect((await deps.events.findById('standup'))?.deletedAt).toBe('2026-11-16T00:00:00.000Z');
		expect(await deps.googleSync.findEventLink('standup')).toBeNull();
		expect(deps.googleSync.calendarLinks.get('work@example.com')).toMatchObject({ calendarId: null, selected: false, syncToken: null });
		// Newly selected calendars get their local calendar on the next sync.
		expect(deps.googleSync.calendarLinks.get('team@example.com')).toMatchObject({ calendarId: null, selected: true });
	});

	test('removing the default calendar promotes a local one', async () => {
		const { deps, localId } = await setup();
		await deps.calendars.save({ ...(await deps.calendars.findById(localId))!, isDefault: false }); // created just above
		await deps.calendars.save(googleCalendar('work', { isDefault: true }));
		await selectGoogleCalendars(deps, { googleIds: [] });
		expect((await deps.calendars.findById(localId))?.isDefault).toBe(true);
	});

	test('disconnecting removes every Google calendar and event, keeping local ones', async () => {
		const { deps, localId } = await setup();
		await deps.events.save(event('mine', localId));
		await deps.events.save(event('standup', 'work'));
		expect(await disconnectGoogleCalendars(deps)).toEqual({ ok: true, value: null });
		expect((await deps.calendars.list()).map(calendar => calendar.id)).toEqual([localId]);
		expect((await deps.events.findById('standup'))?.deletedAt).not.toBeNull();
		expect((await deps.events.findById('mine'))?.deletedAt).toBeNull();
		expect(await listGoogleCalendars(deps)).toEqual([]);
	});
});
