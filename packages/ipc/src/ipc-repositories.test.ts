import { describe, expect, test } from 'bun:test';
import { type Calendar, type CalendarEvent, createEvent, fail, ok, type Result, systemClock, uuidv7Ids } from '@tempi/core';
import type { DesktopApi } from './desktop-api';
import { createIpcRepositories, DesktopApiError } from './ipc-repositories';

const T0 = '2026-11-15T10:00:00.000Z';
const calendar: Calendar = { color: '#3b82f6', createdAt: T0, deletedAt: null, id: 'cal-1', isDefault: true, isVisible: true, name: 'Personal', source: 'local', updatedAt: T0 };

/** A `window.desktop` stand-in backed by maps, answering like the main process does. */
const fakeApi = () => {
	const calendars = new Map([[calendar.id, calendar]]);
	const events = new Map<string, CalendarEvent>();
	const done = <T>(value: T): Promise<Result<T>> => Promise.resolve(ok(value));
	const api: DesktopApi = {
		calendars: {
			get: id => done(calendars.get(id) ?? null),
			list: () => done([...calendars.values()]),
			save: value => done(calendars.set(value.id, value) && null),
		},
		events: {
			deleteByCalendar: () => done(null),
			get: id => done(events.get(id) ?? null),
			list: () => done([...events.values()]),
			save: value => done(events.set(value.id, value) && null),
		},
		profile: { get: () => done(null), save: () => done(null) },
		settings: { get: () => done(null), save: () => done(null) },
		version: 'test',
	};
	return { api, events };
};

describe('createIpcRepositories', () => {
	test('lets core use cases read and write through window.desktop', async () => {
		const { api, events } = fakeApi();
		const deps = { ...createIpcRepositories(api), clock: systemClock, ids: uuidv7Ids };

		const created = await createEvent(deps, { calendarId: 'cal-1', endAt: '2026-11-20T10:00:00Z', startAt: '2026-11-20T09:00:00Z', timeZone: 'UTC', title: 'Standup' });

		expect(created.ok).toBe(true);
		expect([...events.values()]).toEqual([expect.objectContaining({ title: 'Standup' })]);
	});

	test('rethrows a failed result as a DesktopApiError carrying the domain error', async () => {
		const { api } = fakeApi();
		api.calendars.save = () => Promise.resolve(fail('validation', 'calendar.color', { field: 'color' }));

		const rejection = createIpcRepositories(api).calendars.save(calendar);

		await expect(rejection).rejects.toBeInstanceOf(DesktopApiError);
		await expect(rejection).rejects.toMatchObject({ channel: 'calendars:save', error: { code: 'validation', issues: [{ field: 'color', key: 'calendar.color' }] } });
	});

	test('rejects a response that does not match the contract', async () => {
		const { api } = fakeApi();
		api.calendars.list = () => Promise.resolve({ ok: true, value: [{ id: 'broken' }] } as unknown as Result<Calendar[]>);

		await expect(createIpcRepositories(api).calendars.list()).rejects.toThrow('calendars:list returned a malformed response');
	});
});
