import { z } from 'zod';
import type { DateRange } from './date-range';
import { timeOfDaySchema, type WorkingHours } from './settings';
import { idSchema, instantToUtc } from './values';

/** The longest stretch of days one search covers, so a search stays a small, quick read. */
export const MAX_FREE_SLOT_DAYS = 31;
export const MIN_FREE_SLOT_MINUTES = 15;
export const MAX_FREE_SLOT_MINUTES = 480;
export const DEFAULT_FREE_SLOT_MINUTES = 30;

/** The daily window searched while working hours are off. */
export const DEFAULT_FREE_SLOT_WINDOW = { days: [1, 2, 3, 4, 5], end: '18:00', start: '09:00' } as const;

const plainDateSchema = z.string().refine(value => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	try {
		Temporal.PlainDate.from(value, { overflow: 'reject' });
		return true;
	} catch {
		return false;
	}
}, 'validation.invalid_format');

/**
 * A free time search: the days from `from` to `to` (both included, `YYYY-MM-DD` in the user's zone) and, for each, a
 * daily window on some weekdays. Left out, the window and weekdays come from working hours (or 09:00–18:00 Monday to
 * Friday while they're off), the minimum length is 30 minutes and every visible calendar counts.
 */
export const freeSlotsQuerySchema = z
	.object({
		/** Calendars whose events block time. */
		calendarIds: z.array(idSchema).min(1, 'validation.min').optional(),
		/** Weekdays to search, 1 (Monday) to 7 (Sunday). */
		days: z
			.array(z.number().int('validation.integer').min(1, 'validation.min').max(7, 'validation.max'))
			.min(1, 'settings.workingDays')
			.refine(days => new Set(days).size === days.length, 'settings.workingDays')
			.optional(),
		from: plainDateSchema,
		/** The shortest free slot worth listing, in minutes. */
		minMinutes: z.number().int('validation.integer').min(MIN_FREE_SLOT_MINUTES, 'validation.min').max(MAX_FREE_SLOT_MINUTES, 'validation.max').default(DEFAULT_FREE_SLOT_MINUTES),
		to: plainDateSchema,
		windowEnd: timeOfDaySchema.optional(),
		windowStart: timeOfDaySchema.optional(),
	})
	.superRefine((query, ctx) => {
		if (query.windowStart !== undefined && query.windowEnd !== undefined && query.windowEnd <= query.windowStart) {
			ctx.addIssue({ code: 'custom', message: 'range.endBeforeStart', path: ['windowEnd'] });
		}
		if (query.to < query.from) {
			ctx.addIssue({ code: 'custom', message: 'range.endBeforeStart', path: ['to'] });
			return;
		}
		// Both dates passed the format check above only if they parse; a bad one already has its own issue.
		const days = (() => {
			try {
				return Temporal.PlainDate.from(query.from).until(Temporal.PlainDate.from(query.to)).days + 1;
			} catch {
				return 0;
			}
		})();
		if (days > MAX_FREE_SLOT_DAYS) {
			ctx.addIssue({ code: 'too_big', input: days, maximum: MAX_FREE_SLOT_DAYS, message: 'availability.rangeTooLong', origin: 'number', path: ['to'] });
		}
	});

export type FreeSlotsQueryInput = z.input<typeof freeSlotsQuerySchema>;
export type FreeSlotsQuery = z.output<typeof freeSlotsQuerySchema>;

/** One free stretch, as a half-open UTC range. */
export const freeSlotSchema = z.object({ endAt: z.string(), startAt: z.string() });

/** The free slots of each searched day, in order, and the zone the days and window were read in. */
export const freeSlotsSchema = z.object({
	days: z.array(z.object({ date: z.string(), slots: z.array(freeSlotSchema) })),
	timeZone: z.string(),
});

export type FreeSlot = z.output<typeof freeSlotSchema>;
export type FreeSlots = z.output<typeof freeSlotsSchema>;

/** The daily window and weekdays a search uses: the query's own, else working hours when on, else the default. */
export const searchWindow = (query: FreeSlotsQuery, workingHours: WorkingHours) => {
	const base = workingHours.enabled ? workingHours : DEFAULT_FREE_SLOT_WINDOW;
	return { days: query.days ?? base.days, end: query.windowEnd ?? base.end, start: query.windowStart ?? base.start };
};

type Window = ReturnType<typeof searchWindow>;

const searchedDates = (query: FreeSlotsQuery, window: Window): Temporal.PlainDate[] => {
	const dates: Temporal.PlainDate[] = [];
	const last = Temporal.PlainDate.from(query.to);
	for (let date = Temporal.PlainDate.from(query.from); Temporal.PlainDate.compare(date, last) <= 0; date = date.add({ days: 1 })) {
		if (window.days.includes(date.dayOfWeek)) dates.push(date);
	}
	return dates;
};

const windowOf = (date: Temporal.PlainDate, window: Window, timeZone: string) => ({
	end: date.toZonedDateTime({ plainTime: Temporal.PlainTime.from(window.end), timeZone }).epochMilliseconds,
	start: date.toZonedDateTime({ plainTime: Temporal.PlainTime.from(window.start), timeZone }).epochMilliseconds,
});

/** The UTC range covering every searched window, to list the events that may block them; null when no day is searched. */
export const searchRange = (query: FreeSlotsQuery, workingHours: WorkingHours, timeZone: string): DateRange | null => {
	const window = searchWindow(query, workingHours);
	const dates = searchedDates(query, window);
	const first = dates[0];
	const last = dates.at(-1);
	if (first === undefined || last === undefined) return null;
	const toUtc = (ms: number) => instantToUtc(Temporal.Instant.fromEpochMilliseconds(ms));
	return { end: toUtc(windowOf(last, window, timeZone).end), start: toUtc(windowOf(first, window, timeZone).start) };
};

type Busy = { endAt: string; startAt: string };

/**
 * The free slots of each searched day: the day's window in `timeZone`, from `now` on, minus every busy range (merged,
 * so overlapping or back-to-back events leave no gap), keeping only slots of at least `minMinutes`. Days without a free
 * slot are listed empty.
 */
export const freeSlots = (busy: readonly Busy[], query: FreeSlotsQuery, workingHours: WorkingHours, timeZone: string, now: Temporal.Instant): FreeSlots => {
	const window = searchWindow(query, workingHours);
	const minimum = query.minMinutes * 60_000;
	const blocks = busy.map(item => ({ end: Temporal.Instant.from(item.endAt).epochMilliseconds, start: Temporal.Instant.from(item.startAt).epochMilliseconds })).sort((a, b) => a.start - b.start);
	const toUtc = (ms: number) => instantToUtc(Temporal.Instant.fromEpochMilliseconds(ms));

	const days = searchedDates(query, window).map(date => {
		const { end, start } = windowOf(date, window, timeZone);
		const slots: FreeSlot[] = [];
		let cursor = Math.max(start, now.epochMilliseconds);
		const keep = (slotEnd: number) => {
			if (slotEnd - cursor >= minimum) slots.push({ endAt: toUtc(slotEnd), startAt: toUtc(cursor) });
		};
		for (const block of blocks) {
			if (block.end <= cursor || block.start >= end) continue;
			if (block.start > cursor) keep(block.start);
			cursor = Math.max(cursor, block.end);
		}
		if (cursor < end) keep(end);
		return { date: date.toString(), slots };
	});
	return { days, timeZone };
};
