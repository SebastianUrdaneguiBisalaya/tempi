import { fail, ok, type Result } from './result';
import { toUtcInstant } from './values';

/** Half-open UTC range: `start` is inclusive, `end` is exclusive. */
export type DateRange = {
	end: string;
	start: string;
};

export const parseDateRange = (range: DateRange): Result<DateRange> => {
	const start = toUtcInstant(range.start);
	if (start === null) return fail('validation', 'Range start must be an ISO-8601 instant with offset', 'start');
	const end = toUtcInstant(range.end);
	if (end === null) return fail('validation', 'Range end must be an ISO-8601 instant with offset', 'end');
	if (end <= start) return fail('validation', 'Range end must be after its start', 'end');
	return ok({ end, start });
};

/** True when [startAt, endAt) intersects the range. */
export const overlapsRange = (startAt: string, endAt: string, range: DateRange): boolean => startAt < range.end && endAt > range.start;
