import { describe, expect, test } from 'bun:test';
import { layoutDay, MINUTES_PER_DAY } from './day-layout';

const day = Temporal.PlainDate.from('2026-11-15');
const LIMA = 'America/Lima'; // UTC-5, no DST.

/** An item from local Lima times on 2026-11-15, stored in UTC like real events. */
const item = (id: string, start: string, end: string, endDay = '2026-11-15', startDay = '2026-11-15') => ({
	endAt: Temporal.PlainDateTime.from(`${endDay}T${end}`).toZonedDateTime(LIMA).toInstant().toString(),
	id,
	startAt: Temporal.PlainDateTime.from(`${startDay}T${start}`).toZonedDateTime(LIMA).toInstant().toString(),
});

const lanes = (segments: ReturnType<typeof layoutDay>) => Object.fromEntries(segments.map(segment => [segment.item.id, [segment.column, segment.columns]]));

describe('layoutDay', () => {
	test('places UTC instants at the local wall-clock time', () => {
		const [segment] = layoutDay([{ endAt: '2026-11-15T16:30:00.000Z', id: 'a', startAt: '2026-11-15T15:00:00.000Z' }], day, LIMA);
		expect(segment).toMatchObject({ endMinute: 11 * 60 + 30, startMinute: 10 * 60 });
	});

	test('the same instant lands at another hour in another time zone', () => {
		const [segment] = layoutDay([{ endAt: '2026-11-15T01:00:00.000Z', id: 'a', startAt: '2026-11-15T00:00:00.000Z' }], day, 'Asia/Tokyo');
		expect(segment?.startMinute).toBe(9 * 60);
	});

	test('skips items outside the day', () => {
		expect(layoutDay([item('before', '08:00', '09:00', '2026-11-14', '2026-11-14'), item('after', '08:00', '09:00', '2026-11-16', '2026-11-16')], day, LIMA)).toEqual([]);
	});

	test('an item ending exactly at midnight belongs only to the earlier day', () => {
		expect(layoutDay([item('a', '23:00', '00:00', '2026-11-15', '2026-11-14')], day, LIMA)).toEqual([]);
	});

	test('clips items that run across midnight', () => {
		const [segment] = layoutDay([item('a', '22:00', '02:00', '2026-11-16')], day, LIMA);
		expect(segment).toMatchObject({ continuesAfter: true, continuesBefore: false, endMinute: MINUTES_PER_DAY, startMinute: 22 * 60 });
		const [next] = layoutDay([item('a', '22:00', '02:00', '2026-11-16')], day.add({ days: 1 }), LIMA);
		expect(next).toMatchObject({ continuesAfter: false, continuesBefore: true, endMinute: 2 * 60, startMinute: 0 });
	});

	test('items that do not overlap each take the full width', () => {
		expect(lanes(layoutDay([item('a', '09:00', '10:00'), item('b', '10:00', '11:00')], day, LIMA))).toEqual({ a: [0, 1], b: [0, 1] });
	});

	test('overlapping items sit side by side', () => {
		expect(lanes(layoutDay([item('a', '09:00', '11:00'), item('b', '10:00', '12:00'), item('c', '10:30', '11:30')], day, LIMA))).toEqual({
			a: [0, 3],
			b: [1, 3],
			c: [2, 3],
		});
	});

	test('a lane is reused once its item has ended, within the same group', () => {
		// a overlaps b, b overlaps c, but a ends before c starts: c takes a's lane and the group keeps 2 lanes.
		expect(lanes(layoutDay([item('a', '09:00', '10:00'), item('b', '09:30', '11:00'), item('c', '10:00', '10:30')], day, LIMA))).toEqual({
			a: [0, 2],
			b: [1, 2],
			c: [0, 2],
		});
	});

	test('very short items are spaced by their drawn height', () => {
		// 5-minute items drawn 15 minutes tall would cover each other if laid out by their real duration.
		expect(lanes(layoutDay([item('a', '09:00', '09:05'), item('b', '09:05', '09:10')], day, LIMA))).toEqual({ a: [0, 2], b: [1, 2] });
	});

	test('on ties the longer item takes the left lane', () => {
		expect(lanes(layoutDay([item('short', '09:00', '09:30'), item('long', '09:00', '11:00')], day, LIMA))).toEqual({ long: [0, 2], short: [1, 2] });
	});
});
