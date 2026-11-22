import { describe, expect, test } from 'bun:test';
import { fail, ok } from '@tempi/core';
import type { DesktopApi } from './desktop-api';
import { createIpcClient } from './ipc-client';

const T0 = '2026-11-15T10:00:00.000Z';
const calendar = { color: '#3b82f6', createdAt: T0, deletedAt: null, id: 'cal-1', isDefault: true, isVisible: true, name: 'Personal', readOnly: false, source: 'local' as const, updatedAt: T0 };

/** A `window.desktop` stand-in: every call answers `response`, and records what it was sent. */
const fakeApi = (response: () => Promise<unknown>) => {
	const sent: unknown[] = [];
	const showListeners: ((payload: unknown) => void)[] = [];
	const updateListeners: ((payload: unknown) => void)[] = [];
	const chatListeners: ((payload: unknown) => void)[] = [];
	const stopped: string[] = [];
	const answer = (input?: unknown) => {
		sent.push(input);
		return response();
	};
	const api: DesktopApi = {
		ai: {
			chat: (input, listener) => {
				chatListeners.push(listener);
				return answer(input);
			},
			getSettings: answer,
			listVoices: answer,
			quickAdd: answer,
			removeKey: answer,
			saveKey: answer,
			saveSettings: answer,
			stopChat: requestId => void stopped.push(requestId),
			testKey: answer,
			speak: answer,
			transcribe: answer,
		},
		app: {
			copyText: answer,
			onShowEvent: listener => {
				showListeners.push(listener);
				return () => showListeners.splice(showListeners.indexOf(listener), 1);
			},
			showEvent: answer,
		},
		availability: { freeSlots: answer },
		calendars: { create: answer, delete: answer, export: answer, import: answer, list: answer, update: answer },
		data: { backup: answer, restore: answer },
		events: { create: answer, delete: answer, deleteOccurrence: answer, duplicate: answer, list: answer, restore: answer, search: answer, update: answer, updateOccurrence: answer },
		google: { account: answer, calendars: answer, connect: answer, disconnect: answer, onSyncStatus: () => () => undefined, selectCalendars: answer, sync: answer, syncStatus: answer },
		holidays: { sync: answer },
		onboarding: { complete: answer },
		permissions: { openSystemSettings: answer, status: answer, testNotification: answer },
		profile: { get: answer, update: answer },
		settings: { get: answer, previewTheme: answer, save: answer },
		stats: { time: answer },
		updates: {
			check: answer,
			install: answer,
			onStatus: listener => {
				updateListeners.push(listener);
				return () => updateListeners.splice(updateListeners.indexOf(listener), 1);
			},
			status: answer,
		},
		version: 'test',
		weather: { current: answer, searchLocations: answer },
	};
	/** Simulates the main process asking to show an occurrence. */
	const pushShowEvent = (payload: unknown) => {
		for (const listener of showListeners) listener(payload);
	};
	/** Simulates the main process pushing an update status. */
	const pushUpdateStatus = (payload: unknown) => {
		for (const listener of updateListeners) listener(payload);
	};
	/** Simulates the main process streaming an assistant event. */
	const streamChat = (payload: unknown) => {
		for (const listener of chatListeners) listener(payload);
	};
	return { api, pushShowEvent, pushUpdateStatus, sent, stopped, streamChat };
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

	test('passes a pushed occurrence through and drops malformed ones', () => {
		const { api, pushShowEvent } = fakeApi(() => Promise.resolve(null));
		const opened: unknown[] = [];
		const unsubscribe = createIpcClient(api).app.onShowEvent(target => opened.push(target));

		pushShowEvent({ key: 'event-1', startAt: '2026-11-20T09:00:00-05:00' });
		pushShowEvent({ key: '', startAt: 'tomorrow' });
		unsubscribe();
		pushShowEvent({ key: 'event-2', startAt: '2026-11-21T14:00:00Z' });

		expect(opened).toEqual([{ key: 'event-1', startAt: '2026-11-20T14:00:00.000Z' }]);
	});
});

describe('pushed update statuses', () => {
	const status = { checkedAt: null, currentVersion: '0.1.0', downloadUrl: null, latestVersion: '0.2.0', state: 'ready' };

	test('reach the listener once validated', () => {
		const { api, pushUpdateStatus } = fakeApi(() => Promise.resolve(ok(null)));
		const received: unknown[] = [];
		createIpcClient(api).updates.onStatus(next => received.push(next));
		pushUpdateStatus(status);
		expect(received).toEqual([status]);
	});

	test('are dropped when malformed', () => {
		const { api, pushUpdateStatus } = fakeApi(() => Promise.resolve(ok(null)));
		const received: unknown[] = [];
		createIpcClient(api).updates.onStatus(next => received.push(next));
		pushUpdateStatus({ ...status, downloadUrl: 'http://example.com' });
		expect(received).toEqual([]);
	});
});

describe('assistant chat', () => {
	const input = { messages: [{ role: 'user' as const, text: 'Hola' }], provider: 'openai' as const, requestId: '01890a5d-ac96-774b-bcce-b302099a8057' };

	test('passes valid streamed events through and turns a malformed one into an error event', async () => {
		const { api, sent, stopped, streamChat } = fakeApi(() => Promise.resolve(ok(null)));
		const client = createIpcClient(api);
		const received: unknown[] = [];
		expect(await client.ai.chat(input, event => received.push(event))).toEqual({ ok: true, value: null });
		expect(sent.at(-1)).toEqual(input);

		streamChat({ text: 'Hola', type: 'text' });
		streamChat({ type: 'surprise' });
		client.ai.stopChat(input.requestId);

		expect(received).toEqual([
			{ text: 'Hola', type: 'text' },
			{ error: { code: 'internal', issues: [{ detail: 'ai:chat streamed a malformed event', key: 'system.unexpected' }] }, type: 'error' },
		]);
		expect(stopped).toEqual([input.requestId]);
	});
});
