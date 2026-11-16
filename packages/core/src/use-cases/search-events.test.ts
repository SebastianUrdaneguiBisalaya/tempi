import { describe, expect, test } from 'bun:test';
import type { NewEventInput } from '../domain/event';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { deleteEvent } from './delete-event';
import { updateOccurrence } from './occurrences';
import { searchEvents } from './search-events';
import { failure, makeDeps } from './test-fakes';

// The fake clock starts at 2026-11-15T10:00Z.
const NOV = (day: number, hourUtc: number) => `2026-11-${String(day).padStart(2, '0')}T${String(hourUtc).padStart(2, '0')}:00:00.000Z`;

const setup = async () => {
	const deps = makeDeps();
	const calendar = await createCalendar(deps, { color: '#3366ff', name: 'Work' });
	if (!calendar.ok) throw new Error('calendar setup failed');
	const add = async (input: Partial<NewEventInput> & Pick<NewEventInput, 'endAt' | 'startAt' | 'title'>) => {
		const created = await createEvent(deps, { calendarId: calendar.value.id, timeZone: 'UTC', ...input });
		if (!created.ok) throw new Error('event setup failed');
		return created.value;
	};
	const search = async (query: string) => {
		const result = await searchEvents(deps, query);
		if (!result.ok) throw new Error('search failed');
		return result.value;
	};
	return { add, deps, search };
};

describe('searchEvents', () => {
	test('matches title, location and description by word prefix, ignoring case and accents', async () => {
		const { add, search } = await setup();
		await add({ endAt: NOV(20, 10), startAt: NOV(20, 9), title: 'Reunión de equipo' });
		await add({ endAt: NOV(21, 10), location: 'Café Central', startAt: NOV(21, 9), title: 'Breakfast' });
		await add({ description: 'Bring the ÑANDÚ slides', endAt: NOV(22, 10), startAt: NOV(22, 9), title: 'Review' });

		expect((await search('REUNION')).map(event => event.title)).toEqual(['Reunión de equipo']);
		expect((await search('cafe')).map(event => event.title)).toEqual(['Breakfast']);
		expect((await search('nan slid')).map(event => event.title)).toEqual(['Review']);
		expect(await search('union')).toEqual([]);
	});

	test('never returns deleted events', async () => {
		const { add, deps, search } = await setup();
		const event = await add({ endAt: NOV(20, 10), startAt: NOV(20, 9), title: 'Dentist' });
		await deleteEvent(deps, event.id);

		expect(await search('dentist')).toEqual([]);
	});

	test('lists upcoming results soonest first, then past ones latest first', async () => {
		const { add, search } = await setup();
		await add({ endAt: NOV(1, 10), startAt: NOV(1, 9), title: 'Gym early' });
		await add({ endAt: NOV(30, 10), startAt: NOV(30, 9), title: 'Gym late' });
		await add({ endAt: NOV(10, 10), startAt: NOV(10, 9), title: 'Gym recent' });
		await add({ endAt: NOV(16, 10), startAt: NOV(16, 9), title: 'Gym soon' });

		expect((await search('gym')).map(event => event.title)).toEqual(['Gym soon', 'Gym late', 'Gym recent', 'Gym early']);
	});

	test('shows a series as its next occurrence, or its last one once it ended', async () => {
		const { add, search } = await setup();
		const daily = await add({ endAt: NOV(1, 10), rrule: 'FREQ=DAILY', startAt: NOV(1, 9), title: 'Standup' });
		const ended = await add({ endAt: NOV(1, 10), rrule: 'FREQ=DAILY;COUNT=3', startAt: NOV(1, 9), title: 'Standup sprint' });

		const [next, last] = await search('standup');
		expect(next).toMatchObject({ id: daily.id, series: { id: daily.id, originalStartAt: NOV(16, 9) }, startAt: NOV(16, 9) });
		expect(last).toMatchObject({ id: ended.id, startAt: NOV(3, 9) });
	});

	test('shows a series occurrence still in progress', async () => {
		const { add, search } = await setup();
		await add({ endAt: NOV(1, 11), rrule: 'FREQ=DAILY', startAt: NOV(1, 9), title: 'Focus' });

		expect(await search('focus')).toMatchObject([{ startAt: NOV(15, 9) }]);
	});

	test('an edited occurrence keeps its series recurrence', async () => {
		const { add, deps, search } = await setup();
		const series = await add({ endAt: NOV(1, 10), rrule: 'FREQ=DAILY', startAt: NOV(1, 9), title: 'Standup' });
		await updateOccurrence(deps, { originalStartAt: NOV(20, 9), scope: 'this', seriesId: series.id }, { title: 'Retro' });

		expect(await search('retro')).toMatchObject([{ recurringEventId: series.id, rrule: 'FREQ=DAILY', series: { id: series.id, originalStartAt: NOV(20, 9) } }]);
	});

	test('rejects an empty query', async () => {
		const { deps } = await setup();
		expect(await searchEvents(deps, '   ')).toEqual(failure('validation'));
	});
});
