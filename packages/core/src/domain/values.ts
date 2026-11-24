import { z } from 'zod';

// Requires an explicit offset so a value never depends on the machine's local zone.
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Normalizes an ISO-8601 instant with offset to UTC (`…Z`), or returns null if invalid. */
export const toUtcInstant = (value: string): string | null => {
	if (!ISO_INSTANT.test(value)) return null;
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

/**
 * Whether two ranges cover the same instants, whatever text they use (`…00.000Z` from storage, `…00Z` from Temporal
 * or another offset). An invalid instant never matches.
 */
export const isSameRange = (a: { endAt: string; startAt: string }, b: { endAt: string; startAt: string }): boolean => {
	const same = (x: string, y: string) => {
		const utc = toUtcInstant(x);
		return utc !== null && utc === toUtcInstant(y);
	};
	return same(a.startAt, b.startAt) && same(a.endAt, b.endAt);
};

/** A Temporal instant in the same normalized UTC text the schemas output, so stored instants compare as strings. */
export const instantToUtc = (instant: Temporal.Instant): string => new Date(instant.epochMilliseconds).toISOString();

export const isValidTimeZone = (value: string): boolean => {
	if (value.trim() === '') return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value });
		return true;
	} catch {
		return false;
	}
};

// Field schemas shared by every entity. Messages are i18n keys, translated by the UI.

export const idSchema = z.string().trim().min(1, 'validation.required');

export const requiredTextSchema = z.string().trim().min(1, 'validation.required');

/** Trims text and maps blank or missing values to null. */
export const optionalTextSchema = z
	.string()
	.nullish()
	.transform(value => {
		const trimmed = value?.trim() ?? '';
		return trimmed === '' ? null : trimmed;
	});

/** Accepts an ISO-8601 instant with offset and outputs it in UTC. */
export const utcInstantSchema = z.string().transform((value, ctx) => {
	const utc = toUtcInstant(value);
	if (utc === null) {
		ctx.addIssue({ code: 'custom', message: 'validation.instant' });
		return z.NEVER;
	}
	return utc;
});

export const timeZoneSchema = z.string().refine(isValidTimeZone, 'validation.timeZone');

/** A calendar day, `YYYY-MM-DD`, that exists (no February 30). */
export const plainDateSchema = z.string().refine(value => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	try {
		Temporal.PlainDate.from(value, { overflow: 'reject' });
		return true;
	} catch {
		return false;
	}
}, 'validation.invalid_format');
