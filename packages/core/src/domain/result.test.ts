import { describe, expect, test } from 'bun:test';
import { ERROR_KEYS } from './error-keys';
import { newEventInputSchema } from './event';
import { fail, parseWith, zodErrorKeyMap } from './result';
import { settingsPatchSchema } from './settings';

describe('parseWith', () => {
	test('reports every issue, not only the first', () => {
		const result = parseWith(newEventInputSchema, { calendarId: '', endAt: 'tomorrow', startAt: '2026-11-20T09:00:00Z', timeZone: 'Nowhere', title: '' });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('validation');
		expect(result.error.issues.map(issue => issue.field).sort()).toEqual(['calendarId', 'endAt', 'timeZone', 'title']);
	});

	test('keeps schema keys and describes them in English for developers', () => {
		const result = parseWith(newEventInputSchema, { calendarId: 'c', endAt: '2026-11-20T09:00:00Z', startAt: '2026-11-20T09:00:00Z', timeZone: 'UTC', title: 'x' });

		expect(result.ok || result.error.issues).toEqual([{ detail: ERROR_KEYS['event.endBeforeStart'], field: 'endAt', key: 'event.endBeforeStart' }]);
	});

	test('turns built-in zod errors into keys and keeps the original message as detail', () => {
		const result = parseWith(settingsPatchSchema, { showWeekends: 'yes' });

		expect(result.ok || result.error.issues).toEqual([
			{ detail: expect.stringContaining('expected boolean'), field: 'showWeekends', key: 'validation.invalid_type', params: { expected: 'boolean' } },
		]);
	});

	test('passes interpolation params for limits', () => {
		const result = parseWith(settingsPatchSchema, { defaultEventDuration: 2000 });

		expect(result.ok || result.error.issues[0]).toMatchObject({ key: 'validation.max', params: { maximum: 1440 } });
	});
});

describe('fail', () => {
	test('builds a single-issue error with a default English detail', () => {
		expect(fail('not_found', 'event.notFound', { field: 'id' })).toEqual({
			error: { code: 'not_found', issues: [{ detail: 'Event not found', field: 'id', key: 'event.notFound' }] },
			ok: false,
		});
	});
});

describe('zodErrorKeyMap', () => {
	test('maps built-in codes to keys so form errors are translatable', () => {
		const parsed = settingsPatchSchema.safeParse({ theme: 'neon' }, { error: zodErrorKeyMap });
		expect(parsed.error?.issues[0]?.message).toBe('validation.invalid_value');
	});
});
