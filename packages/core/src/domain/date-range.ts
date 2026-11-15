import { z } from 'zod';
import { utcInstantSchema } from './values';

/** Half-open UTC range: `start` is inclusive, `end` is exclusive. */
export const dateRangeSchema = z
	.object({
		end: utcInstantSchema,
		start: utcInstantSchema,
	})
	.refine(range => range.end > range.start, { message: 'range.endBeforeStart', path: ['end'] });

export type DateRange = z.output<typeof dateRangeSchema>;

/** True when [startAt, endAt) intersects the range. */
export const overlapsRange = (startAt: string, endAt: string, range: DateRange): boolean => startAt < range.end && endAt > range.start;
