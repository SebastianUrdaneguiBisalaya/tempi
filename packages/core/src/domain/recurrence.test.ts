import { describe, expect, test } from 'bun:test';
import { fromRrule, isValidRrule, occurrenceStarts, presetOf, presetRecurrence, type Recurrence, recurrenceSchemaFor, splitRrule, toRrule } from './recurrence';

const NEW_YORK = 'America/New_York';
// Thursday 2026-03-05, 9:00 EST. DST starts on Sunday 2026-03-08.
const start = Temporal.ZonedDateTime.from('2026-03-05T09:00[America/New_York]');
const series = { endAt: '2026-03-05T15:00:00.000Z', exDates: [], rrule: 'FREQ=DAILY', startAt: '2026-03-05T14:00:00.000Z', timeZone: NEW_YORK };
const range = (from: string, to: string) => ({ end: `${to}T00:00:00.000Z`, start: `${from}T00:00:00.000Z` });

describe('occurrenceStarts', () => {
	test('keeps the wall-clock time across a DST change', () => {
		expect(occurrenceStarts(series, range('2026-03-07', '2026-03-10'))).toEqual(['2026-03-07T14:00:00.000Z', '2026-03-08T13:00:00.000Z', '2026-03-09T13:00:00.000Z']);
	});

	test('includes an occurrence that started before the range and still runs into it', () => {
		const late = { ...series, endAt: '2026-03-06T05:00:00.000Z', startAt: '2026-03-06T03:00:00.000Z' }; // 22:00–00:00
		expect(occurrenceStarts(late, { end: '2026-03-07T06:00:00.000Z', start: '2026-03-07T05:00:00.000Z' })).toEqual([]);
		expect(occurrenceStarts(late, { end: '2026-03-07T05:00:00.000Z', start: '2026-03-07T04:30:00.000Z' })).toEqual(['2026-03-07T03:00:00.000Z']);
	});

	test('skips excluded dates and stops at COUNT', () => {
		const counted = { ...series, exDates: ['2026-03-06T14:00:00.000Z'], rrule: 'FREQ=DAILY;COUNT=3' };
		expect(occurrenceStarts(counted, range('2026-03-01', '2026-03-31'))).toEqual(['2026-03-05T14:00:00.000Z', '2026-03-07T14:00:00.000Z']);
	});

	test('counts the start as the first occurrence even off the pattern', () => {
		expect(occurrenceStarts({ ...series, rrule: 'FREQ=WEEKLY;BYDAY=MO' }, range('2026-03-01', '2026-03-10'))).toEqual(['2026-03-05T14:00:00.000Z', '2026-03-09T13:00:00.000Z']);
	});
});

describe('splitRrule', () => {
	test('ends the head right before the split and keeps the rule for the tail', () => {
		expect(splitRrule(series, '2026-03-09T13:00:00.000Z')).toEqual({ head: 'FREQ=DAILY;UNTIL=20260309T125959Z', tail: 'FREQ=DAILY' });
	});

	test('shares a COUNT between head and tail', () => {
		const { head, tail } = splitRrule({ ...series, rrule: 'FREQ=DAILY;COUNT=5' }, '2026-03-07T14:00:00.000Z');
		expect(tail).toBe('FREQ=DAILY;COUNT=3');
		expect(occurrenceStarts({ ...series, rrule: head }, range('2026-03-01', '2026-03-31'))).toEqual(['2026-03-05T14:00:00.000Z', '2026-03-06T14:00:00.000Z']);
	});
});

describe('toRrule and fromRrule', () => {
	const custom = (changes: Partial<Recurrence>): Recurrence => ({ ...presetRecurrence('WEEKLY', start.toPlainDate()), ...changes });

	test.each([
		['every 2 weeks on Monday and Thursday', custom({ interval: 2, weekdays: ['TH', 'MO'] }), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH'],
		['monthly on the first Thursday, 5 times', custom({ count: 5, ends: 'count', frequency: 'MONTHLY', monthlyMode: 'weekdayOfMonth' }), 'FREQ=MONTHLY;BYDAY=1TH;COUNT=5'],
		['daily until the end of a day in the event zone', custom({ ends: 'until', frequency: 'DAILY', until: '2026-03-20' }), 'FREQ=DAILY;UNTIL=20260321T035959Z'],
	])('%s', (_name, recurrence, rrule) => {
		expect(toRrule(recurrence, start)).toBe(rrule);
		expect(toRrule(fromRrule(rrule, start) ?? presetRecurrence('DAILY', start.toPlainDate()), start)).toBe(rrule);
	});

	test('uses "last" for a weekday in the last week of the month', () => {
		const lastFriday = Temporal.ZonedDateTime.from('2026-01-30T10:00[Europe/Madrid]');
		expect(toRrule({ ...presetRecurrence('MONTHLY', lastFriday.toPlainDate()), monthlyMode: 'weekdayOfMonth' }, lastFriday)).toBe('FREQ=MONTHLY;BYDAY=-1FR');
	});

	test('reads rules the form can’t show as null', () => {
		expect(fromRrule('FREQ=MONTHLY;BYMONTHDAY=1,15', start)).toBeNull();
		expect(fromRrule('FREQ=HOURLY', start)).toBeNull();
	});
});

describe('presetOf', () => {
	test('names presets and falls back to custom', () => {
		expect(presetOf(null, start)).toBe('none');
		expect(presetOf('FREQ=WEEKLY', start)).toBe('weekly');
		expect(presetOf('FREQ=MONTHLY', start)).toBe('monthly');
		expect(presetOf('FREQ=WEEKLY;INTERVAL=2', start)).toBe('custom');
	});
});

test('isValidRrule accepts only rules the library can expand', () => {
	expect(isValidRrule('FREQ=WEEKLY;BYDAY=FR')).toBe(true);
	expect(isValidRrule('FREQ=SOMETIMES')).toBe(false);
	expect(isValidRrule('every friday')).toBe(false);
});

test('recurrenceSchemaFor rejects an end date before the start', () => {
	const schema = recurrenceSchemaFor(start.toPlainDate());
	expect(schema.safeParse({ ...presetRecurrence('DAILY', start.toPlainDate()), ends: 'until', until: '2026-03-04' }).error?.issues[0]).toMatchObject({
		message: 'recurrence.untilBeforeStart',
		path: ['until'],
	});
	expect(schema.safeParse({ ...presetRecurrence('DAILY', start.toPlainDate()), ends: 'until', until: '2026-03-05' }).success).toBe(true);
});
