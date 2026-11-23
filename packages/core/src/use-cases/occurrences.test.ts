import { describe, expect, test } from 'bun:test';
import type { EventOccurrence } from '../domain/event';
import { createCalendar } from './create-calendar';
import { createEvent } from './create-event';
import { listEvents } from './list-events';
import { deleteOccurrence, updateOccurrence } from './occurrences';
import { failure, makeDeps } from './test-fakes';

// Daily standup at 9:00 New York from Thursday 2026-03-05; DST starts on Sunday 2026-03-08.
const MAR = (day: number, hourUtc: number, minute = 0) => `2026-03-${String(day).padStart(2, '0')}T${String(hourUtc).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
const WEEK = { end: MAR(12, 0), start: MAR(5, 0) };

const setup = async (rrule = 'FREQ=DAILY') => {
	const deps = makeDeps();
	const calendar = await createCalendar(deps, { color: '#3366ff', name: 'Work' });
	if (!calendar.ok) throw new Error('calendar setup failed');
	const series = await createEvent(deps, { calendarId: calendar.value.id, endAt: MAR(5, 14, 30), rrule, startAt: MAR(5, 14), timeZone: 'America/New_York', title: 'Standup' });
	if (!series.ok) throw new Error('series setup failed');
	const list = async (range = WEEK): Promise<EventOccurrence[]> => {
		const result = await listEvents(deps, range);
		if (!result.ok) throw new Error('list failed');
		return result.value;
	};
	return { calendarId: calendar.value.id, deps, list, seriesId: series.value.id };
};

const summary = (occurrences: EventOccurrence[]) => occurrences.map(occurrence => `${occurrence.startAt} ${occurrence.title}`);

describe('listEvents with recurrence', () => {
	test('expands a series into occurrences that keep 9:00 local across DST', async () => {
		const { list, seriesId } = await setup();
		const occurrences = await list();
		expect(occurrences.map(occurrence => occurrence.startAt)).toEqual([MAR(5, 14), MAR(6, 14), MAR(7, 14), MAR(8, 13), MAR(9, 13), MAR(10, 13), MAR(11, 13)]);
		expect(occurrences[3]).toMatchObject({ endAt: MAR(8, 13, 30), id: seriesId, key: `${seriesId}:${MAR(8, 13)}`, series: { id: seriesId, originalStartAt: MAR(8, 13) } });
	});
});

describe('updateOccurrence', () => {
	test('"this" edits one occurrence and leaves the others untouched', async () => {
		const { deps, list, seriesId } = await setup();
		const result = await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId }, { endAt: MAR(6, 16), startAt: MAR(6, 15), title: 'Moved standup' });

		expect(result).toMatchObject({ ok: true, value: { recurringEventId: seriesId, rrule: null, series: { id: seriesId, originalStartAt: MAR(6, 14) }, startAt: MAR(6, 15) } });
		const occurrences = await list();
		expect(summary(occurrences).slice(0, 3)).toEqual([`${MAR(5, 14)} Standup`, `${MAR(6, 15)} Moved standup`, `${MAR(7, 14)} Standup`]);
		expect(occurrences).toHaveLength(7);
	});

	test('"this" on an already edited occurrence updates that same event', async () => {
		const { deps, list, seriesId } = await setup();
		await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId }, { title: 'Once' });
		await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId }, { title: 'Twice' });
		expect(summary(await list()).filter(line => line.includes(MAR(6, 14)))).toEqual([`${MAR(6, 14)} Twice`]);
	});

	test('"all" moves every occurrence by the same wall-clock shift and drops edited ones', async () => {
		const { deps, list, seriesId } = await setup();
		await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId }, { title: 'Edited' });
		// The occurrence on Monday 9:00 EDT moves to 10:00: the whole series moves to 10:00 local.
		const result = await updateOccurrence(deps, { originalStartAt: MAR(9, 13), scope: 'all', seriesId }, { endAt: MAR(9, 14, 30), startAt: MAR(9, 14) });

		expect(result).toMatchObject({ ok: true, value: { series: { originalStartAt: MAR(9, 14) }, startAt: MAR(9, 14) } });
		expect(summary(await list())).toEqual([MAR(5, 15), MAR(6, 15), MAR(7, 15), MAR(8, 14), MAR(9, 14), MAR(10, 14), MAR(11, 14)].map(start => `${start} Standup`));
	});

	test('"all" with only new details keeps edited occurrences and passes the details to them', async () => {
		const { deps, list, seriesId } = await setup();
		await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId }, { endAt: MAR(6, 16), startAt: MAR(6, 15) });
		await updateOccurrence(deps, { originalStartAt: MAR(9, 13), scope: 'all', seriesId }, { title: 'Daily sync' });

		const occurrences = await list();
		expect(occurrences.every(occurrence => occurrence.title === 'Daily sync')).toBe(true);
		expect(occurrences[1]?.startAt).toBe(MAR(6, 15));
	});

	test('"following" ends the series before the occurrence and starts a new one there', async () => {
		const { deps, list, seriesId } = await setup('FREQ=DAILY;COUNT=6');
		const result = await updateOccurrence(deps, { originalStartAt: MAR(8, 13), scope: 'following', seriesId }, { title: 'New standup' });
		if (!result.ok) throw new Error('update failed');

		expect(result.value.id).not.toBe(seriesId);
		expect(summary(await list())).toEqual([
			`${MAR(5, 14)} Standup`,
			`${MAR(6, 14)} Standup`,
			`${MAR(7, 14)} Standup`,
			`${MAR(8, 13)} New standup`,
			`${MAR(9, 13)} New standup`,
			`${MAR(10, 13)} New standup`,
		]);
	});

	test('"following" on the first occurrence edits the whole series', async () => {
		const { deps, list, seriesId } = await setup();
		await updateOccurrence(deps, { originalStartAt: MAR(5, 14), scope: 'following', seriesId }, { title: 'Renamed' });
		const occurrences = await list();
		expect(occurrences.every(occurrence => occurrence.id === seriesId && occurrence.title === 'Renamed')).toBe(true);
	});

	test('rejects a start that is not an occurrence, and invalid changes', async () => {
		const { deps, seriesId } = await setup();
		expect(await updateOccurrence(deps, { originalStartAt: MAR(6, 15), scope: 'this', seriesId }, { title: 'x' })).toEqual(failure('not_found', 'id'));
		expect(await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'all', seriesId }, { endAt: MAR(6, 13) })).toEqual(failure('validation', 'endAt'));
	});
});

describe('deleteOccurrence', () => {
	test('"this" removes only that occurrence, including an edited one', async () => {
		const { deps, list, seriesId } = await setup();
		await updateOccurrence(deps, { originalStartAt: MAR(7, 14), scope: 'this', seriesId }, { title: 'Edited' });
		await deleteOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId });
		await deleteOccurrence(deps, { originalStartAt: MAR(7, 14), scope: 'this', seriesId });
		expect((await list()).map(occurrence => occurrence.startAt)).toEqual([MAR(5, 14), MAR(8, 13), MAR(9, 13), MAR(10, 13), MAR(11, 13)]);
	});

	test('"following" ends the series before the occurrence', async () => {
		const { deps, list, seriesId } = await setup();
		await updateOccurrence(deps, { originalStartAt: MAR(10, 13), scope: 'this', seriesId }, { title: 'Edited' });
		await deleteOccurrence(deps, { originalStartAt: MAR(8, 13), scope: 'following', seriesId });
		expect((await list()).map(occurrence => occurrence.startAt)).toEqual([MAR(5, 14), MAR(6, 14), MAR(7, 14)]);
	});

	test('"all" removes the series and its edited occurrences', async () => {
		const { deps, list, seriesId } = await setup();
		await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId }, { title: 'Edited' });
		await deleteOccurrence(deps, { originalStartAt: MAR(9, 13), scope: 'all', seriesId });
		expect(await list()).toEqual([]);
	});
});

test('an edited occurrence lists with its series’ recurrence', async () => {
	const { deps, list, seriesId } = await setup();
	await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId }, { title: 'Edited' });
	expect((await list()).find(occurrence => occurrence.title === 'Edited')).toMatchObject({ recurringEventId: seriesId, rrule: 'FREQ=DAILY' });
});

describe('updateOccurrence with a Google Meet', () => {
	test("a local series can't get a Meet, for one occurrence or all", async () => {
		const { deps, seriesId } = await setup();
		expect(await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'this', seriesId }, { googleMeet: true })).toEqual(failure('validation', 'googleMeet'));
		expect(await updateOccurrence(deps, { originalStartAt: MAR(6, 14), scope: 'all', seriesId }, { googleMeet: true })).toEqual(failure('validation', 'googleMeet'));
	});

	test('splitting a series with a Meet leaves the new series without the old link', async () => {
		const deps = makeDeps();
		const calendar = await createCalendar(deps, { color: '#0b8043', name: 'Ada', source: 'google' });
		if (!calendar.ok) throw new Error('calendar setup failed');
		const series = await createEvent(deps, {
			calendarId: calendar.value.id,
			endAt: MAR(5, 14, 30),
			googleMeet: true,
			rrule: 'FREQ=DAILY',
			startAt: MAR(5, 14),
			timeZone: 'America/New_York',
			title: 'Standup',
			videoUrl: 'https://meet.google.com/abc-defg-hij',
		});
		if (!series.ok) throw new Error('series setup failed');
		const tail = await updateOccurrence(deps, { originalStartAt: MAR(7, 14), scope: 'following', seriesId: series.value.id }, { title: 'New standup' });
		expect(tail).toMatchObject({ ok: true, value: { googleMeet: true, title: 'New standup', videoUrl: null } });
	});
});
