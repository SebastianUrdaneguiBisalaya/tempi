import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DatabaseSync } from 'node:sqlite';
import { type CoreDeps, createEvent, deleteEvent, listReminders, type NewEventInput, updateCalendar, updateEvent, uuidv7Ids } from '@tempi/core';
import { createRepositories, openDatabase } from '@tempi/db';
import { createReminderScheduler, MAX_WAIT_MS, type ReminderScheduler } from './reminder-scheduler';

const T0 = Date.parse('2026-11-20T13:00:00.000Z');

let db: DatabaseSync;
let deps: CoreDeps;
let now: number;
let saved: string | null;
let timer: { callback: () => void; at: number } | null;
let notified: string[];
let scheduler: ReminderScheduler;

const start = () => {
	scheduler = createReminderScheduler({
		checkpoint: { load: () => saved, save: instant => void (saved = instant) },
		listReminders: range => listReminders(deps, range),
		notify: ({ fireAt, occurrence }) => notified.push(`${occurrence.title}@${fireAt.slice(11, 16)}`),
		now: () => new Date(now),
		setTimer: (callback, ms) => {
			const planned = { at: now + ms, callback };
			timer = planned;
			return () => {
				if (timer === planned) timer = null;
			};
		},
	});
	return scheduler.reschedule();
};

/** Moves the clock forward, running the pending timer whenever it comes due, as a running app would. */
const advanceTo = async (iso: string) => {
	const target = Date.parse(iso);
	while (timer !== null && timer.at <= target) {
		now = timer.at;
		timer.callback();
		await scheduler.reschedule();
	}
	now = target;
};

const calendarId = async () => {
	const [calendar] = await deps.calendars.list();
	if (calendar === undefined) throw new Error('no calendar');
	return calendar.id;
};

const create = async (input: Partial<NewEventInput>) => {
	const created = await createEvent(deps, {
		calendarId: await calendarId(),
		endAt: '2026-11-20T15:00:00Z',
		reminderMinutes: 10,
		startAt: '2026-11-20T14:00:00Z',
		timeZone: 'America/Lima',
		title: 'Standup',
		...input,
	});
	if (!created.ok) throw new Error('event setup failed');
	return created.value;
};

beforeEach(() => {
	now = T0;
	const clock = { now: () => new Date(now) };
	db = openDatabase(':memory:', { clock });
	deps = { ...createRepositories(db), avatars: { remove: () => Promise.resolve(), save: () => Promise.resolve() }, clock, ids: uuidv7Ids };
	saved = null;
	timer = null;
	notified = [];
});

afterEach(() => {
	scheduler.stop();
	db.close();
});

describe('createReminderScheduler', () => {
	test('fires a reminder at its time, once', async () => {
		await create({});
		await start();
		expect(timer?.at).toBe(Date.parse('2026-11-20T13:50:00Z'));

		await advanceTo('2026-11-20T13:49:59Z');
		expect(notified).toEqual([]);
		await advanceTo('2026-11-20T16:00:00Z');
		expect(notified).toEqual(['Standup@13:50']);
	});

	test('fires every occurrence of a recurring event', async () => {
		await create({ rrule: 'FREQ=DAILY;COUNT=3' });
		await start();
		await advanceTo('2026-11-23T00:00:00Z');
		expect(notified).toEqual(['Standup@13:50', 'Standup@13:50', 'Standup@13:50']);
	});

	test('waits at most MAX_WAIT_MS between checks', async () => {
		await create({ endAt: '2026-11-22T15:00:00Z', startAt: '2026-11-22T14:00:00Z' });
		await start();
		expect(timer?.at).toBe(T0 + MAX_WAIT_MS);
	});

	test('a deleted event never fires, even without a reschedule', async () => {
		const event = await create({});
		await start();
		await deleteEvent(deps, event.id);
		await advanceTo('2026-11-20T16:00:00Z');
		expect(notified).toEqual([]);
	});

	test('a moved event fires at its new time once rescheduled', async () => {
		const event = await create({});
		await start();
		await updateEvent(deps, event.id, { reminderMinutes: 30 });
		await scheduler.reschedule();
		await advanceTo('2026-11-20T16:00:00Z');
		expect(notified).toEqual(['Standup@13:30']);
	});

	test('a new event fires once rescheduled', async () => {
		await start();
		await create({});
		await scheduler.reschedule();
		await advanceTo('2026-11-20T16:00:00Z');
		expect(notified).toEqual(['Standup@13:50']);
	});

	test('events of hidden calendars stay quiet', async () => {
		await create({});
		await updateCalendar(deps, await calendarId(), { isVisible: false });
		await start();
		await advanceTo('2026-11-20T16:00:00Z');
		expect(notified).toEqual([]);
	});

	test('after a restart, fires missed reminders whose event has not ended, without repeating delivered ones', async () => {
		await create({ endAt: '2026-11-20T13:30:00Z', reminderMinutes: 0, startAt: '2026-11-20T13:05:00Z', title: 'Delivered' });
		await create({ title: 'In progress' });
		await create({ endAt: '2026-11-20T14:30:00Z', reminderMinutes: 0, startAt: '2026-11-20T14:20:00Z', title: 'Over' });
		await start();
		await advanceTo('2026-11-20T13:10:00Z');
		scheduler.stop();
		expect(notified).toEqual(['Delivered@13:05']);

		// Closed until 14:40: "In progress" (14:00–15:00) is still running, "Over" ended at 14:30.
		now = Date.parse('2026-11-20T14:40:00Z');
		await start();
		expect(notified).toEqual(['Delivered@13:05', 'In progress@13:50']);
	});

	test('the first run does not fire reminders from before it', async () => {
		await create({ reminderMinutes: 90 });
		await start();
		await advanceTo('2026-11-20T16:00:00Z');
		expect(notified).toEqual([]);
	});

	test('stops planning after stop', async () => {
		await create({});
		await start();
		scheduler.stop();
		expect(timer).toBeNull();
	});
});
