import { describe, expect, test } from 'bun:test';
import type { ImportedEvent } from '../domain/ical-transfer';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { exportEvents } from './export-events';
import { importEvents } from './import-events';
import { listEvents } from './list-events';
import { failure, makeDeps } from './test-fakes';

const setup = async () => {
	const deps = makeDeps();
	const calendar = await createCalendar(deps, { color: '#3366ff', name: 'Work' });
	const other = await createCalendar(deps, { color: '#22aa66', name: 'Home' });
	if (!calendar.ok || !other.ok) throw new Error('calendar setup failed');
	return { calendarId: calendar.value.id, deps, otherId: other.value.id };
};

const standup = (overrides: Partial<ImportedEvent> = {}): ImportedEvent => ({
	exDates: [],
	fields: { endAt: '2026-11-20T15:00:00Z', startAt: '2026-11-20T14:00:00Z', timeZone: 'America/Lima', title: 'Standup' },
	overrides: [],
	uid: 'standup@example.com',
	...overrides,
});

const live = (deps: ReturnType<typeof makeDeps>) => [...deps.events.rows.values()].filter(event => event.deletedAt === null);

const WEEK = { end: '2026-11-27T00:00:00Z', start: '2026-11-20T00:00:00Z' };

describe('importEvents', () => {
	test('adds the events to the calendar, keeping their UID', async () => {
		const { calendarId, deps } = await setup();
		const result = await importEvents(deps, { calendarId, events: [standup(), standup({ fields: { ...standup().fields, title: 'Review' }, uid: null })] });

		expect(result).toEqual({ ok: true, value: { created: 2, skipped: 0, updated: 0 } });
		expect(live(deps).map(event => [event.title, event.calendarId, event.icalUid])).toEqual([
			['Standup', calendarId, 'standup@example.com'],
			['Review', calendarId, null],
		]);
	});

	test('importing the same file again updates the events instead of copying them', async () => {
		const { calendarId, deps } = await setup();
		await importEvents(deps, { calendarId, events: [standup()] });
		const [first] = live(deps);
		if (first === undefined) throw new Error('import failed');

		const again = await importEvents(deps, { calendarId, events: [standup({ fields: { ...standup().fields, title: 'Daily standup' } })] });

		expect(again).toEqual({ ok: true, value: { created: 0, skipped: 0, updated: 1 } });
		expect(live(deps).map(event => [event.id, event.title, event.createdAt])).toEqual([[first.id, 'Daily standup', first.createdAt]]);
	});

	test('the same UID in another calendar is a different event', async () => {
		const { calendarId, deps, otherId } = await setup();
		await importEvents(deps, { calendarId, events: [standup()] });
		expect(await importEvents(deps, { calendarId: otherId, events: [standup()] })).toEqual({ ok: true, value: { created: 1, skipped: 0, updated: 0 } });
	});

	test('a series keeps its exceptions: skipped dates and edited occurrences', async () => {
		const { calendarId, deps } = await setup();
		const series = standup({
			exDates: ['2026-11-21T14:00:00Z'],
			fields: { ...standup().fields, rrule: 'FREQ=DAILY;COUNT=4' },
			overrides: [{ fields: { ...standup().fields, endAt: '2026-11-22T17:00:00Z', startAt: '2026-11-22T16:00:00Z', title: 'Late standup' }, originalStartAt: '2026-11-22T14:00:00Z' }],
		});

		await importEvents(deps, { calendarId, events: [series] });
		const listed = await listEvents(deps, WEEK);

		expect(listed.ok && listed.value.map(event => [event.title, event.startAt])).toEqual([
			['Standup', '2026-11-20T14:00:00.000Z'],
			['Late standup', '2026-11-22T16:00:00.000Z'],
			['Standup', '2026-11-23T14:00:00.000Z'],
		]);
	});

	test('re-importing a series replaces its edited occurrences', async () => {
		const { calendarId, deps } = await setup();
		const override = { fields: { ...standup().fields, endAt: '2026-11-22T17:00:00Z', startAt: '2026-11-22T16:00:00Z', title: 'Late standup' }, originalStartAt: '2026-11-22T14:00:00Z' };
		const series = standup({ fields: { ...standup().fields, rrule: 'FREQ=DAILY;COUNT=4' }, overrides: [override] });
		await importEvents(deps, { calendarId, events: [series] });
		await importEvents(deps, { calendarId, events: [series] });

		expect(live(deps).map(event => event.title)).toEqual(['Standup', 'Late standup']);
	});

	test('skips what breaks the rules and imports the rest', async () => {
		const { calendarId, deps } = await setup();
		const broken = standup({ fields: { ...standup().fields, title: '  ' }, uid: 'broken' });
		const backwards = standup({ fields: { ...standup().fields, endAt: '2026-11-20T13:00:00Z' }, uid: 'backwards' });
		const badOverride = standup({
			fields: { ...standup().fields, rrule: 'FREQ=DAILY;COUNT=2' },
			overrides: [{ fields: { title: 'No times' }, originalStartAt: '2026-11-21T14:00:00Z' }],
			uid: 'series',
		});

		const result = await importEvents(deps, { calendarId, events: [broken, backwards, badOverride] });

		expect(result).toEqual({ ok: true, value: { created: 1, skipped: 3, updated: 0 } });
		expect(live(deps).map(event => event.icalUid)).toEqual(['series']);
	});

	test('fails for a calendar that does not exist', async () => {
		const { deps } = await setup();
		expect(await importEvents(deps, { calendarId: '01890a5d-ac96-774b-bcce-b302099a8057', events: [standup()] })).toEqual(failure('not_found', 'calendarId'));
	});
});

describe('exportEvents', () => {
	test('exports one calendar, or all of them', async () => {
		const { calendarId, deps, otherId } = await setup();
		await createEvent(deps, { calendarId, endAt: '2026-11-20T15:00:00Z', startAt: '2026-11-20T14:00:00Z', timeZone: 'UTC', title: 'Work thing' });
		await createEvent(deps, { calendarId: otherId, endAt: '2026-11-20T15:00:00Z', startAt: '2026-11-20T14:00:00Z', timeZone: 'UTC', title: 'Home thing' });

		const one = await exportEvents(deps, { calendarId });
		const all = await exportEvents(deps, { calendarId: null });

		expect(one.ok && [one.value.calendars.map(calendar => calendar.name), one.value.events.map(event => event.title)]).toEqual([['Work'], ['Work thing']]);
		expect(all.ok && all.value.events.map(event => event.title).sort()).toEqual(['Home thing', 'Work thing']);
	});

	test('fails for a calendar that does not exist', async () => {
		const { deps } = await setup();
		expect(await exportEvents(deps, { calendarId: '01890a5d-ac96-774b-bcce-b302099a8057' })).toEqual(failure('not_found', 'calendarId'));
	});
});
