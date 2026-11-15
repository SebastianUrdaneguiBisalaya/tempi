import { describe, expect, test } from 'bun:test';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { deleteCalendar } from './delete-calendar';
import { listCalendars } from './list-calendars';
import { failure, makeDeps, T0 } from './test-fakes';
import { updateCalendar } from './update-calendar';

const create = async (deps: ReturnType<typeof makeDeps>, name: string, isDefault?: boolean) => {
	const result = await createCalendar(deps, { color: '#AABBCC', isDefault, name });
	if (!result.ok) throw new Error(`could not create ${name}`);
	return result.value;
};

describe('createCalendar', () => {
	test('makes the first calendar the default with local source and timestamps', async () => {
		const deps = makeDeps();
		const calendar = await create(deps, ' Personal ');
		expect(calendar).toMatchObject({ color: '#aabbcc', createdAt: T0, deletedAt: null, isDefault: true, isVisible: true, name: 'Personal', source: 'local', updatedAt: T0 });
	});

	test('keeps exactly one default when a new default is created', async () => {
		const deps = makeDeps();
		const first = await create(deps, 'Personal');
		const second = await create(deps, 'Work', true);

		expect((await deps.calendars.findById(first.id))?.isDefault).toBe(false);
		expect(second.isDefault).toBe(true);
	});

	test.each([
		['name', { color: '#aabbcc', name: '' }],
		['color', { color: 'red', name: 'Work' }],
	] as const)('rejects an invalid %s', async (field, input) => {
		const deps = makeDeps();
		const result = await createCalendar(deps, input);
		expect(result).toEqual(failure('validation', field));
	});
});

describe('updateCalendar', () => {
	test('updates fields and bumps updatedAt', async () => {
		const deps = makeDeps();
		const calendar = await create(deps, 'Personal');
		deps.clock.set('2026-11-16T00:00:00.000Z');

		const result = await updateCalendar(deps, calendar.id, { isVisible: false, name: 'Home' });
		expect(result.ok && result.value).toMatchObject({ createdAt: T0, isVisible: false, name: 'Home', updatedAt: '2026-11-16T00:00:00.000Z' });
	});

	test('promoting a calendar to default demotes the previous one', async () => {
		const deps = makeDeps();
		const first = await create(deps, 'Personal');
		const second = await create(deps, 'Work');

		await updateCalendar(deps, second.id, { isDefault: true });
		expect((await deps.calendars.findById(first.id))?.isDefault).toBe(false);
		expect((await deps.calendars.findById(second.id))?.isDefault).toBe(true);
	});

	test('refuses to unset the default directly', async () => {
		const deps = makeDeps();
		const calendar = await create(deps, 'Personal');
		const result = await updateCalendar(deps, calendar.id, { isDefault: false });
		expect(result).toEqual(failure('conflict'));
	});
});

describe('deleteCalendar', () => {
	test('soft-deletes the calendar and its events', async () => {
		const deps = makeDeps();
		await create(deps, 'Personal');
		const work = await create(deps, 'Work');
		const event = await createEvent(deps, { calendarId: work.id, endAt: '2026-11-20T10:00:00Z', startAt: '2026-11-20T09:00:00Z', timeZone: 'UTC', title: 'Review' });
		if (!event.ok) throw new Error('setup failed');

		deps.clock.set('2026-11-18T00:00:00.000Z');
		expect(await deleteCalendar(deps, work.id)).toEqual({ ok: true, value: null });

		expect((await deps.calendars.findById(work.id))?.deletedAt).toBe('2026-11-18T00:00:00.000Z');
		expect((await deps.events.findById(event.value.id))?.deletedAt).toBe('2026-11-18T00:00:00.000Z');
		expect((await listCalendars(deps)).map(calendar => calendar.name)).toEqual(['Personal']);
	});

	test('refuses to delete the default calendar', async () => {
		const deps = makeDeps();
		const calendar = await create(deps, 'Personal');
		expect(await deleteCalendar(deps, calendar.id)).toEqual(failure('conflict'));
	});
});

describe('listCalendars', () => {
	test('lists the default first, then by name', async () => {
		const deps = makeDeps();
		await create(deps, 'Zeta');
		await create(deps, 'Beta');
		await create(deps, 'Alpha');
		expect((await listCalendars(deps)).map(calendar => calendar.name)).toEqual(['Zeta', 'Alpha', 'Beta']);
	});
});
