import { describe, expect, test } from 'bun:test';
import { MAX_QUICK_ADD_TEXT, quickAddInputSchema, quickAddProposalSchema } from './quick-add';
import { parseWith } from './result';

const proposal = {
	allDay: false,
	description: null,
	endAt: '2026-11-20T18:00:00-05:00',
	location: 'Larcomar',
	reminderMinutes: 30,
	startAt: '2026-11-20T17:00:00-05:00',
	title: 'Café con Ana',
};

const issues = (input: unknown) => {
	const result = parseWith(quickAddProposalSchema, input);
	return result.ok ? [] : result.error.issues.map(issue => [issue.field, issue.key]);
};

describe('quick add proposal', () => {
	test('normalizes instants to UTC and blank text to null', () => {
		expect(quickAddProposalSchema.parse({ ...proposal, description: '  ' })).toEqual({
			...proposal,
			description: null,
			endAt: '2026-11-20T23:00:00.000Z',
			startAt: '2026-11-20T22:00:00.000Z',
		});
	});

	test('reuses the event field rules and reports every issue', () => {
		expect(issues({ ...proposal, endAt: 'tomorrow', reminderMinutes: 1.5, title: ' ' })).toEqual([
			['endAt', 'validation.instant'],
			['reminderMinutes', 'validation.integer'],
			['title', 'validation.required'],
		]);
		expect(issues({ ...proposal, endAt: proposal.startAt })).toEqual([['endAt', 'event.endBeforeStart']]);
	});

	test('rejects fields outside the proposal, such as a calendar or a recurrence', () => {
		expect(quickAddProposalSchema.safeParse({ ...proposal, rrule: 'FREQ=DAILY' }).success).toBe(false);
	});
});

describe('quick add input', () => {
	test('trims the text and caps its length', () => {
		expect(quickAddInputSchema.parse({ text: '  Lunch tomorrow ' })).toEqual({ text: 'Lunch tomorrow' });
		expect(quickAddInputSchema.safeParse({ text: 'x'.repeat(MAX_QUICK_ADD_TEXT) }).success).toBe(true);
		expect(quickAddInputSchema.safeParse({ text: 'x'.repeat(MAX_QUICK_ADD_TEXT + 1) }).success).toBe(false);
		expect(quickAddInputSchema.safeParse({ text: '   ' }).success).toBe(false);
	});
});
