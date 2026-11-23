import { describe, expect, test } from 'bun:test';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { deleteEvent } from './delete-event';
import { duplicateEvent } from './duplicate-event';
import { listEvents } from './list-events';
import { deleteOccurrence, updateOccurrence } from './occurrences';
import { failure, makeDeps, T0 } from './test-fakes';

const setup = async (rrule: string | null = null) => {
	const deps = makeDeps();
	const calendar = await createCalendar(deps, { color: '#3366ff', name: 'Work' });
	if (!calendar.ok) throw new Error('calendar setup failed');
	const event = await createEvent(deps, {
		calendarId: calendar.value.id,
		description: 'Notes',
		endAt: '2026-11-20T15:00:00Z',
		location: 'Room 1',
		reminderMinutes: 10,
		rrule,
		startAt: '2026-11-20T14:00:00Z',
		status: 'tentative',
		timeZone: 'America/Lima',
		title: 'Review',
		videoUrl: 'https://meet.example/x',
	});
	if (!event.ok) throw new Error('event setup failed');
	return { deps, event: event.value };
};

describe('duplicateEvent', () => {
	test('copies every field with a new id and new timestamps', async () => {
		const { deps, event } = await setup();
		deps.clock.set('2026-11-16T08:00:00.000Z');
		const result = await duplicateEvent(deps, event.id);
		if (!result.ok) throw new Error('duplicate failed');

		const { createdAt, id, updatedAt, ...fields } = result.value;
		const { createdAt: _createdAt, id: _id, updatedAt: _updatedAt, ...original } = event;
		expect(fields).toEqual(original);
		expect(id).not.toBe(event.id);
		expect({ createdAt, updatedAt }).toEqual({ createdAt: '2026-11-16T08:00:00.000Z', updatedAt: '2026-11-16T08:00:00.000Z' });
		expect(event.createdAt).toBe(T0);
	});

	test('copies the whole series from an edited occurrence, keeping deleted dates but not edits', async () => {
		const { deps, event } = await setup('FREQ=DAILY;COUNT=4');
		const edited = await updateOccurrence(deps, { originalStartAt: '2026-11-21T14:00:00Z', scope: 'this', seriesId: event.id }, { title: 'Moved' });
		if (!edited.ok) throw new Error('edit failed');
		await deleteOccurrence(deps, { originalStartAt: '2026-11-23T14:00:00Z', scope: 'this', seriesId: event.id });

		const copy = await duplicateEvent(deps, edited.value.id);
		expect(copy).toMatchObject({ ok: true, value: { exDates: ['2026-11-23T14:00:00.000Z'], recurringEventId: null, rrule: 'FREQ=DAILY;COUNT=4', title: 'Review' } });
		const listed = await listEvents(deps, { end: '2026-11-25T00:00:00Z', start: '2026-11-20T00:00:00Z' });
		expect(listed.ok && listed.value.map(occurrence => occurrence.title)).toEqual(['Review', 'Review', 'Moved', 'Review', 'Review', 'Review']);
	});

	test('fails for a missing or deleted event', async () => {
		const { deps, event } = await setup();
		await deleteEvent(deps, event.id);
		expect(await duplicateEvent(deps, event.id)).toEqual(failure('not_found', 'id'));
		expect(await duplicateEvent(deps, 'missing')).toEqual(failure('not_found', 'id'));
	});
});

describe('duplicateEvent with a Google Meet', () => {
	test('the copy asks for a Meet of its own instead of sharing the link', async () => {
		const deps = makeDeps();
		const calendar = await createCalendar(deps, { color: '#0b8043', name: 'Ada', source: 'google' });
		if (!calendar.ok) throw new Error('calendar setup failed');
		const event = await createEvent(deps, {
			calendarId: calendar.value.id,
			endAt: '2026-11-20T15:00:00Z',
			googleMeet: true,
			startAt: '2026-11-20T14:00:00Z',
			timeZone: 'UTC',
			title: 'Kickoff',
			videoUrl: 'https://meet.google.com/abc-defg-hij',
		});
		if (!event.ok) throw new Error('event setup failed');
		expect(await duplicateEvent(deps, event.value.id)).toMatchObject({ ok: true, value: { googleMeet: true, videoUrl: null } });
	});
});
