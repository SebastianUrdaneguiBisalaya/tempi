import { describe, expect, test } from 'bun:test';
import type { NewEventInput } from '../domain/event';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { deleteCalendar } from './delete-calendar';
import { deleteEvent } from './delete-event';
import { listEvents } from './list-events';
import { restoreEvent } from './restore-event';
import { failure, makeDeps, T0 } from './test-fakes';
import { updateEvent } from './update-event';

const setup = async () => {
	const deps = makeDeps();
	const calendar = await createCalendar(deps, { color: '#3366ff', name: 'Personal' });
	if (!calendar.ok) throw new Error('calendar setup failed');
	const input: NewEventInput = {
		calendarId: calendar.value.id,
		endAt: '2026-11-20T10:00:00-05:00',
		startAt: '2026-11-20T09:00:00-05:00',
		timeZone: 'America/Lima',
		title: '  Standup  ',
	};
	return { calendarId: calendar.value.id, deps, input };
};

describe('createEvent', () => {
	test('stores a normalized event with UTC instants and timestamps', async () => {
		const { deps, input } = await setup();
		const result = await createEvent(deps, { ...input, description: '   ', rrule: 'RRULE:FREQ=WEEKLY;BYDAY=FR' });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toMatchObject({
			allDay: false,
			createdAt: T0,
			deletedAt: null,
			description: null,
			endAt: '2026-11-20T15:00:00.000Z',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
			startAt: '2026-11-20T14:00:00.000Z',
			status: 'confirmed',
			title: 'Standup',
			updatedAt: T0,
		});
		expect(await deps.events.findById(result.value.id)).toEqual(result.value);
	});

	test.each([
		['title', { title: '   ' }],
		['startAt', { startAt: '2026-11-20T09:00:00' }],
		['endAt', { endAt: '2026-11-20T08:00:00-05:00' }],
		['timeZone', { timeZone: 'Mars/Olympus' }],
		['videoUrl', { videoUrl: 'javascript:alert(1)' }],
		['rrule', { rrule: 'every friday' }],
		['reminderMinutes', { reminderMinutes: -5 }],
	] as const)('rejects an invalid %s', async (field, override) => {
		const { deps, input } = await setup();
		const result = await createEvent(deps, { ...input, ...override });
		expect(result).toEqual(failure('validation', field));
		expect(deps.events.rows.size).toBe(0);
	});

	test('rejects an unknown calendar', async () => {
		const { deps, input } = await setup();
		const result = await createEvent(deps, { ...input, calendarId: 'missing' });
		expect(result).toEqual(failure('not_found', 'calendarId'));
	});
});

describe('updateEvent', () => {
	test('applies the patch, keeps createdAt and bumps updatedAt', async () => {
		const { deps, input } = await setup();
		const created = await createEvent(deps, input);
		if (!created.ok) throw new Error('setup failed');

		deps.clock.set('2026-11-16T08:00:00.000Z');
		const result = await updateEvent(deps, created.value.id, { status: 'tentative', title: 'Daily' });

		expect(result.ok && result.value).toMatchObject({ createdAt: T0, status: 'tentative', title: 'Daily', updatedAt: '2026-11-16T08:00:00.000Z' });
	});

	test('leaves fields that are not in the patch untouched', async () => {
		const { deps, input } = await setup();
		const created = await createEvent(deps, { ...input, description: 'Notes', reminderMinutes: 10 });
		if (!created.ok) throw new Error('setup failed');

		const result = await updateEvent(deps, created.value.id, { title: 'Daily' });
		expect(result.ok && result.value).toMatchObject({ description: 'Notes', reminderMinutes: 10, title: 'Daily' });
	});

	test('rejects a patch with a wrongly typed field', async () => {
		const { deps, input } = await setup();
		const created = await createEvent(deps, input);
		if (!created.ok) throw new Error('setup failed');

		// Simulates an unvalidated payload arriving from IPC.
		const result = await updateEvent(deps, created.value.id, JSON.parse('{"allDay":"yes"}'));
		expect(result).toEqual(failure('validation', 'allDay'));
	});

	test('rejects a patch that ends the event before it starts', async () => {
		const { deps, input } = await setup();
		const created = await createEvent(deps, input);
		if (!created.ok) throw new Error('setup failed');

		const result = await updateEvent(deps, created.value.id, { endAt: '2026-11-20T13:00:00Z' });
		expect(result.ok).toBe(false);
		expect(await deps.events.findById(created.value.id)).toEqual(created.value);
	});

	test('treats a deleted event as not found', async () => {
		const { deps, input } = await setup();
		const created = await createEvent(deps, input);
		if (!created.ok) throw new Error('setup failed');
		await deleteEvent(deps, created.value.id);

		const result = await updateEvent(deps, created.value.id, { title: 'Again' });
		expect(result).toEqual(failure('not_found'));
	});
});

describe('deleteEvent', () => {
	test('soft-deletes by stamping deletedAt and updatedAt', async () => {
		const { deps, input } = await setup();
		const created = await createEvent(deps, input);
		if (!created.ok) throw new Error('setup failed');

		deps.clock.set('2026-11-17T00:00:00.000Z');
		expect(await deleteEvent(deps, created.value.id)).toEqual({ ok: true, value: null });

		const stored = await deps.events.findById(created.value.id);
		expect(stored).toMatchObject({ deletedAt: '2026-11-17T00:00:00.000Z', updatedAt: '2026-11-17T00:00:00.000Z' });
	});

	test('fails for an unknown event', async () => {
		const { deps } = await setup();
		expect((await deleteEvent(deps, 'missing')).ok).toBe(false);
	});
});

describe('restoreEvent', () => {
	test('brings a deleted event back as it was', async () => {
		const { deps, input } = await setup();
		const created = await createEvent(deps, input);
		if (!created.ok) throw new Error('setup failed');
		await deleteEvent(deps, created.value.id);

		deps.clock.set('2026-11-18T00:00:00.000Z');
		expect(await restoreEvent(deps, created.value.id)).toEqual({ ok: true, value: { ...created.value, updatedAt: '2026-11-18T00:00:00.000Z' } });
		const listed = await listEvents(deps, { end: '2026-11-21T00:00:00Z', start: '2026-11-20T00:00:00Z' });
		expect(listed.ok && listed.value.map(event => event.id)).toEqual([created.value.id]);
	});

	test('leaves an event that is not deleted unchanged', async () => {
		const { deps, input } = await setup();
		const created = await createEvent(deps, input);
		if (!created.ok) throw new Error('setup failed');
		expect(await restoreEvent(deps, created.value.id)).toEqual({ ok: true, value: created.value });
	});

	test('fails when the event never existed or its calendar was deleted', async () => {
		const { calendarId, deps, input } = await setup();
		expect(await restoreEvent(deps, 'missing')).toEqual(failure('not_found', 'id'));

		const other = await createCalendar(deps, { color: '#22aa55', name: 'Work' });
		if (!other.ok) throw new Error('setup failed');
		const created = await createEvent(deps, { ...input, calendarId: other.value.id });
		if (!created.ok) throw new Error('setup failed');
		expect(calendarId).not.toBe(other.value.id);
		await deleteCalendar(deps, other.value.id);
		expect(await restoreEvent(deps, created.value.id)).toEqual(failure('not_found', 'calendarId'));
	});
});

describe('listEvents', () => {
	test('returns non-deleted events overlapping the range, ordered by start', async () => {
		const { deps, input } = await setup();
		const late = await createEvent(deps, { ...input, endAt: '2026-11-21T12:00:00Z', startAt: '2026-11-21T11:00:00Z', title: 'Late' });
		const early = await createEvent(deps, { ...input, endAt: '2026-11-19T12:00:00Z', startAt: '2026-11-19T11:00:00Z', title: 'Early' });
		const gone = await createEvent(deps, { ...input, title: 'Gone' });
		await createEvent(deps, { ...input, endAt: '2026-12-01T12:00:00Z', startAt: '2026-12-01T11:00:00Z', title: 'Outside' });
		if (!gone.ok) throw new Error('setup failed');
		await deleteEvent(deps, gone.value.id);

		const result = await listEvents(deps, { end: '2026-11-23T00:00:00Z', start: '2026-11-16T00:00:00Z' });

		expect(result.ok && result.value.map(event => event.title)).toEqual(['Early', 'Late']);
		expect(early.ok && late.ok).toBe(true);
	});

	test('rejects a range whose end is not after its start', async () => {
		const { deps } = await setup();
		const result = await listEvents(deps, { end: '2026-11-16T00:00:00Z', start: '2026-11-16T00:00:00Z' });
		expect(result).toEqual(failure('validation', 'end'));
	});
});
