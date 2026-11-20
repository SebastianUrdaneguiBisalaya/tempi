import { z } from 'zod';
import { eventInputFieldsSchema } from './event';
import type { Language } from './settings';
import { utcInstantSchema } from './values';

/** The most text quick add sends to a provider: a sentence or two describing one event. */
export const MAX_QUICK_ADD_TEXT = 500;

const fields = eventInputFieldsSchema.shape;

/**
 * A new event an AI provider read from quick add text, checked with the event field rules; it is also the structured
 * output the model fills. All-day events start at midnight in the user's zone and end at midnight after their last
 * day, like any stored all-day event.
 */
export const quickAddProposalSchema = z
	.strictObject({
		allDay: fields.allDay,
		description: fields.description,
		endAt: utcInstantSchema,
		location: fields.location,
		reminderMinutes: fields.reminderMinutes,
		startAt: utcInstantSchema,
		title: fields.title,
	})
	.refine(event => event.endAt > event.startAt, { message: 'event.endBeforeStart', path: ['endAt'] });

export type QuickAddProposal = z.output<typeof quickAddProposalSchema>;

/** Text to read with AI quick add. The provider comes from the saved settings, never from the request. */
export const quickAddInputSchema = z.object({
	text: z.string().trim().min(1, 'validation.required').max(MAX_QUICK_ADD_TEXT, 'validation.max'),
});

export type QuickAddInput = z.input<typeof quickAddInputSchema>;

/** What the model must know to resolve "tomorrow at 5pm": built fresh for every request in the main process. */
export type QuickAddContext = {
	now: Date;
	/** The user's IANA time zone, from their profile. */
	timeZone: string;
	language: Language;
	/** Minutes a timed event lasts when the text gives no end. */
	defaultEventDuration: number;
};
