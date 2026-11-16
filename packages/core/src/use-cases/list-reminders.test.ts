import { describe, expect, test } from 'bun:test';
import type { NewEventInput } from '../domain/event';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { deleteEvent } from './delete-event';
import { listReminders } from './list-reminders';
import { deleteOccurrence } from './occurrences';
import { makeDeps } from './test-fakes';
import { updateCalendar } from './update-calendar';
import { updateEvent } from './update-event';

const setup = async () => {
	const deps = makeDeps();
	const calendar = await createCalendar(deps, { color: '#3366ff', name: 'Work' });
	if (!calendar.ok) throw new Error('calendar setup failed');
	const input: NewEventInput = {
		calendarId: calendar.value.id,
		endAt: '2026-11-20T15:00:00Z',
		reminderMinutes: 10,
		startAt: '2026-11-20T14:00:00Z',
		timeZone: 'America/Lima',
		title: 'Standup',
	};
	const create = async (overrides: Partial<NewEventInput> = {}) => {
		const created = await createEvent(deps, { ...input, ...overrides });
		if (!created.ok) throw new Error('event setup failed');
		return created.value;
	};
	return { calendarId: calendar.value.id, create, deps };
};

const DAY = { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' };

describe('listReminders', () => {
	test('fires reminderMinutes before the start, in order', async () => {
		const { create, deps } = await setup();
		await create({ endAt: '2026-11-20T18:00:00Z', reminderMinutes: 0, startAt: '2026-11-20T17:00:00Z', title: 'Review' });
		await create();
		await create({ reminderMinutes: null, title: 'Quiet' });

		const result = await listReminders(deps, DAY);

		expect(result.ok && result.value.map(({ fireAt, occurrence }) => [fireAt, occurrence.title])).toEqual([
			['2026-11-20T13:50:00.000Z', 'Standup'],
			['2026-11-20T17:00:00.000Z', 'Review'],
		]);
	});

	test('includes only reminders firing inside the range, even for events starting after it', async () => {
		const { create, deps } = await setup();
		await create({ endAt: '2026-11-21T10:00:00Z', reminderMinutes: 1440, startAt: '2026-11-21T09:00:00Z', title: 'Tomorrow' });
		await create({ endAt: '2026-11-20T01:00:00Z', reminderMinutes: 30, startAt: '2026-11-20T00:10:00Z', title: 'Reminded yesterday' });

		const result = await listReminders(deps, DAY);

		expect(result.ok && result.value.map(({ occurrence }) => occurrence.title)).toEqual(['Tomorrow']);
	});

	test('reminds every occurrence of a series except deleted ones', async () => {
		const { create, deps } = await setup();
		const series = await create({ rrule: 'FREQ=DAILY;COUNT=3' });
		await deleteOccurrence(deps, { originalStartAt: '2026-11-21T14:00:00.000Z', scope: 'this', seriesId: series.id });

		const result = await listReminders(deps, { end: '2026-11-23T00:00:00Z', start: '2026-11-20T00:00:00Z' });

		expect(result.ok && result.value.map(({ fireAt }) => fireAt)).toEqual(['2026-11-20T13:50:00.000Z', '2026-11-22T13:50:00.000Z']);
	});

	test('reflects edits and deletions', async () => {
		const { create, deps } = await setup();
		const moved = await create();
		const gone = await create({ title: 'Gone' });
		await updateEvent(deps, moved.id, { endAt: '2026-11-20T21:00:00Z', startAt: '2026-11-20T20:00:00Z' });
		await deleteEvent(deps, gone.id);

		const result = await listReminders(deps, DAY);

		expect(result.ok && result.value.map(({ fireAt, occurrence }) => [fireAt, occurrence.title])).toEqual([['2026-11-20T19:50:00.000Z', 'Standup']]);
	});

	test('skips events of hidden calendars', async () => {
		const { calendarId, create, deps } = await setup();
		await create();
		await updateCalendar(deps, calendarId, { isVisible: false });

		expect(await listReminders(deps, DAY)).toEqual({ ok: true, value: [] });
	});

	test('rejects a range whose end is not after its start', async () => {
		const { deps } = await setup();
		expect((await listReminders(deps, { end: DAY.start, start: DAY.start })).ok).toBe(false);
	});
});

describe('reminderMinutes', () => {
	test('is at most a week', async () => {
		const { create, deps } = await setup();
		const event = await create({ reminderMinutes: 7 * 24 * 60 });
		expect((await updateEvent(deps, event.id, { reminderMinutes: 7 * 24 * 60 + 1 })).ok).toBe(false);
	});
});
