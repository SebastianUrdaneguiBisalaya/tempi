import type { FreeSlots, Language, TimeFormat } from '@tempi/core';
import { formatShortDate, formatTimeRange, formatTimeZoneOffset } from '@/lib/date-format';
import { toUtcDate } from '@/lib/plain-date';

type TextOptions = {
	language: Language;
	timeFormat: TimeFormat;
	/** The translated "no free time" line and the closing "Times in {{zone}}." line. */
	labels: { empty: string; timesIn: (zone: string) => string };
};

/**
 * Free time as plain text to paste into a message: one line per day with free slots, e.g.
 * "Tue, Nov 25: 10:00 – 12:00, 15:00 – 17:00", then the zone the times are in.
 */
export const availabilityText = (found: FreeSlots, { labels, language, timeFormat }: TextOptions): string => {
	const days = found.days.filter(day => day.slots.length > 0);
	const first = days[0]?.slots[0];
	if (first === undefined) return labels.empty;
	const lines = days.map(day => {
		const date = formatShortDate(toUtcDate(Temporal.PlainDate.from(day.date)), { language, timeZone: 'UTC' });
		const slots = day.slots.map(slot => formatTimeRange(slot.startAt, slot.endAt, { language, timeFormat, timeZone: found.timeZone }));
		return `${date}: ${slots.join(', ')}`;
	});
	return [...lines, '', labels.timesIn(formatTimeZoneOffset(first.startAt, { language, timeZone: found.timeZone }))].join('\n');
};
