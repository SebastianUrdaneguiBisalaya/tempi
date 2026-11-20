import { describe, expect, test } from 'bun:test';
import type { NewEventInput } from '../domain/event';
import { countRemainingToday } from './count-remaining-today';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { deleteEvent } from './delete-event';
import { deleteOccurrence } from './occurrences';
import { makeDeps } from './test-fakes';
import { updateCalendar } from './update-calendar';

const setup = async () => {
	const deps = makeDeps();
	const calendar = await createCalendar(deps, { color: '#3366ff', name: 'Work' });
	if (!calendar.ok) throw new Error('calendar setup failed');
	const create = async (overrides: Partial<NewEventInput> = {}) => {
		const created = await createEvent(deps, {
			calendarId: calendar.value.id,
			endAt: '2026-11-20T20:00:00Z',
			startAt: '2026-11-20T19:00:00Z',
			timeZone: 'America/Lima',
			title: 'Review',
			...overrides,
		});
		if (!created.ok) throw new Error('event setup failed');
		return created.value;
	};
	return { calendarId: calendar.value.id, create, deps };
};

// 10:00 in Lima.
const NOW = Temporal.Instant.from('2026-11-20T15:00:00Z');

describe('countRemainingToday', () => {
	test('counts single events, series occurrences and all-day events left today', async () => {
		const { create, deps } = await setup();
		await create();
		await create({ endAt: '2026-11-20T15:30:00Z', rrule: 'FREQ=DAILY;COUNT=3', startAt: '2026-11-20T14:30:00Z', title: 'Standup' });
		await create({ allDay: true, endAt: '2026-11-21T05:00:00Z', startAt: '2026-11-20T05:00:00Z', title: 'Holiday' });
		await create({ endAt: '2026-11-21T14:00:00Z', startAt: '2026-11-21T13:00:00Z', title: 'Tomorrow' });

		expect(await countRemainingToday(deps, NOW, 'America/Lima')).toEqual({ ok: true, value: { count: 3, nextChangeAt: '2026-11-20T15:30:00.000Z' } });
	});

	test('leaves out deleted events, deleted occurrences and hidden calendars', async () => {
		const { calendarId, create, deps } = await setup();
		const gone = await create();
		await deleteEvent(deps, gone.id);
		const series = await create({ rrule: 'FREQ=DAILY;COUNT=2' });
		await deleteOccurrence(deps, { originalStartAt: '2026-11-20T19:00:00.000Z', scope: 'this', seriesId: series.id });
		expect(await countRemainingToday(deps, NOW, 'America/Lima')).toEqual({ ok: true, value: { count: 0, nextChangeAt: '2026-11-21T05:00:00.000Z' } });

		await create();
		await updateCalendar(deps, calendarId, { isVisible: false });
		expect(await countRemainingToday(deps, NOW, 'America/Lima')).toMatchObject({ ok: true, value: { count: 0 } });
	});
});
