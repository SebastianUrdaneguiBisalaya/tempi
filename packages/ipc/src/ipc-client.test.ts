import { describe, expect, test } from 'bun:test';
import { fail, ok } from '@tempi/core';
import type { DesktopApi } from './desktop-api';
import { createIpcClient } from './ipc-client';

const T0 = '2026-11-15T10:00:00.000Z';
const calendar = { color: '#3b82f6', createdAt: T0, deletedAt: null, id: 'cal-1', isDefault: true, isVisible: true, name: 'Personal', source: 'local' as const, updatedAt: T0 };

/** A `window.desktop` stand-in: every call answers `response`, and records what it was sent. */
const fakeApi = (response: () => Promise<unknown>) => {
	const sent: unknown[] = [];
	const reminderListeners: ((payload: unknown) => void)[] = [];
	const answer = (input?: unknown) => {
		sent.push(input);
		return response();
	};
	const api: DesktopApi = {
		calendars: { create: answer, delete: answer, list: answer, update: answer },
		events: { create: answer, delete: answer, deleteOccurrence: answer, duplicate: answer, list: answer, restore: answer, search: answer, update: answer, updateOccurrence: answer },
		onboarding: { complete: answer },
		profile: { get: answer, update: answer },
		reminders: {
			onOpen: listener => {
				reminderListeners.push(listener);
				return () => reminderListeners.splice(reminderListeners.indexOf(listener), 1);
			},
		},
		settings: { get: answer, save: answer },
		version: 'test',
	};
	/** Simulates the main process pushing a clicked reminder. */
	const pushReminder = (payload: unknown) => {
		for (const listener of reminderListeners) listener(payload);
	};
	return { api, pushReminder, sent };
};

describe('createIpcClient', () => {
	test('passes the input through and returns a valid success result', async () => {
		const { api, sent } = fakeApi(() => Promise.resolve(ok([calendar])));
		expect(await createIpcClient(api).calendars.list()).toEqual({ ok: true, value: [calendar] });

		await createIpcClient(api).calendars.update({ id: 'cal-1', name: 'Home' });
		expect(sent.at(-1)).toEqual({ id: 'cal-1', name: 'Home' });
	});

	test('returns a domain failure from the main process unchanged', async () => {
		const failure = fail('conflict', 'calendar.defaultNotDeletable', { field: 'id' });
		const { api } = fakeApi(() => Promise.resolve(failure));
		expect(await createIpcClient(api).calendars.delete({ id: 'cal-1', moveEventsTo: null })).toEqual(failure);
	});

	test('turns a malformed response into an internal failure', async () => {
		const { api } = fakeApi(() => Promise.resolve({ ok: true, value: [{ id: 'broken' }] }));
		expect(await createIpcClient(api).calendars.list()).toMatchObject({
			error: { code: 'internal', issues: [{ detail: 'calendars:list returned a malformed response', key: 'system.unexpected' }] },
			ok: false,
		});
	});

	test('turns a rejected invoke into an internal failure instead of throwing', async () => {
		const { api } = fakeApi(() => Promise.reject(new Error('No handler registered')));
		expect(await createIpcClient(api).settings.get()).toMatchObject({
			error: { code: 'internal', issues: [{ detail: expect.stringContaining('No handler registered'), key: 'system.unexpected' }] },
			ok: false,
		});
	});

	test('passes a clicked reminder through and drops malformed ones', () => {
		const { api, pushReminder } = fakeApi(() => Promise.resolve(null));
		const opened: unknown[] = [];
		const unsubscribe = createIpcClient(api).reminders.onOpen(target => opened.push(target));

		pushReminder({ key: 'event-1', startAt: '2026-11-20T09:00:00-05:00' });
		pushReminder({ key: '', startAt: 'tomorrow' });
		unsubscribe();
		pushReminder({ key: 'event-2', startAt: '2026-11-21T14:00:00Z' });

		expect(opened).toEqual([{ key: 'event-1', startAt: '2026-11-20T14:00:00.000Z' }]);
	});
});
