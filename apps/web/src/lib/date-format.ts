import type { Language, TimeFormat } from '@tempi/core';

/** Where and how to display an instant: the UI language, the user's 12h/24h choice and an IANA time zone. */
export type DateFormatOptions = {
	language: Language;
	/** Defaults to the system time zone. */
	timeZone?: string;
};

export type TimeFormatOptions = DateFormatOptions & { timeFormat: TimeFormat };

// Instants are stored as UTC ISO-8601 text; formatting converts them to the display time zone.
const toDate = (instant: Date | string): Date => (typeof instant === 'string' ? new Date(instant) : instant);

// Constructing Intl formatters is costly and calendar grids format hundreds of cells, so reuse them per option set.
const formatters = new Map<string, Intl.DateTimeFormat>();
const formatter = (language: Language, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
	const cacheKey = `${language}|${JSON.stringify(options)}`;
	let cached = formatters.get(cacheKey);
	if (cached === undefined) {
		cached = new Intl.DateTimeFormat(language, options);
		formatters.set(cacheKey, cached);
	}
	return cached;
};

const hourCycle = (timeFormat: TimeFormat): Intl.DateTimeFormatOptions['hourCycle'] => (timeFormat === '12h' ? 'h12' : 'h23');

/** e.g. "Sunday, November 15, 2026" / "domingo, 15 de noviembre de 2026" with the default `dateStyle: 'full'`. */
export const formatDate = (instant: Date | string, { language, timeZone }: DateFormatOptions, style: Intl.DateTimeFormatOptions['dateStyle'] = 'full'): string =>
	formatter(language, { dateStyle: style, timeZone }).format(toDate(instant));

/** e.g. "9:30 PM" (12h) or "21:30" (24h). */
export const formatTime = (instant: Date | string, { language, timeFormat, timeZone }: TimeFormatOptions): string =>
	formatter(language, { hour: 'numeric', hourCycle: hourCycle(timeFormat), minute: '2-digit', timeZone }).format(toDate(instant));

/** e.g. "Nov 15, 2026, 9:30 PM". */
export const formatDateTime = (instant: Date | string, { language, timeFormat, timeZone }: TimeFormatOptions): string =>
	formatter(language, { day: 'numeric', hour: 'numeric', hourCycle: hourCycle(timeFormat), minute: '2-digit', month: 'short', timeZone, year: 'numeric' }).format(toDate(instant));

/** A start–end span collapsed by Intl, e.g. "9:00 – 10:30 AM" on the same day. */
export const formatTimeRange = (start: Date | string, end: Date | string, { language, timeFormat, timeZone }: TimeFormatOptions): string =>
	formatter(language, { hour: 'numeric', hourCycle: hourCycle(timeFormat), minute: '2-digit', timeZone }).formatRange(toDate(start), toDate(end));

/** Weekday name, e.g. "Mon" / "lun" (`short`) or "Monday" / "lunes" (`long`). */
export const formatWeekday = (instant: Date | string, { language, timeZone }: DateFormatOptions, style: 'long' | 'narrow' | 'short' = 'short'): string =>
	formatter(language, { timeZone, weekday: style }).format(toDate(instant));

/** Weekday, month and day, e.g. "Tue, Nov 25" / "mar, 25 nov". */
export const formatShortDate = (instant: Date | string, { language, timeZone }: DateFormatOptions): string =>
	formatter(language, { day: 'numeric', month: 'short', timeZone, weekday: 'short' }).format(toDate(instant));

/** The zone's offset name at `instant`, e.g. "GMT-5". */
export const formatTimeZoneOffset = (instant: Date | string, { language, timeZone }: DateFormatOptions): string =>
	formatter(language, { timeZone, timeZoneName: 'shortOffset' })
		.formatToParts(toDate(instant))
		.find(part => part.type === 'timeZoneName')?.value ??
	timeZone ??
	'';

/** Month and day, e.g. "March 5" / "5 de marzo". */
export const formatMonthDay = (instant: Date | string, { language, timeZone }: DateFormatOptions): string => formatter(language, { day: 'numeric', month: 'long', timeZone }).format(toDate(instant));

/** Month and year for calendar headers, e.g. "November 2026" / "noviembre de 2026". */
export const formatMonthYear = (instant: Date | string, { language, timeZone }: DateFormatOptions): string => formatter(language, { month: 'long', timeZone, year: 'numeric' }).format(toDate(instant));

const relativeFormatters = new Map<Language, Intl.RelativeTimeFormat>();

/**
 * How long until `minutes` from now, e.g. "in 5 minutes" / "en 5 minutos": minutes under an hour, hours under a day,
 * days after that. Rounds up under an hour, so a start that is seconds away still reads "in 1 minute".
 */
export const formatRelativeMinutes = (minutes: number, language: Language): string => {
	let format = relativeFormatters.get(language);
	if (format === undefined) {
		format = new Intl.RelativeTimeFormat(language, { numeric: 'always' });
		relativeFormatters.set(language, format);
	}
	if (minutes < 60) return format.format(Math.max(1, Math.ceil(minutes)), 'minute');
	if (minutes < 24 * 60) return format.format(Math.round(minutes / 60), 'hour');
	return format.format(Math.round(minutes / (24 * 60)), 'day');
};

const durationFormatters = new Map<Language, Intl.NumberFormat>();

/** A length of time in hours, e.g. "12.5 hr" / "12,5 h"; under an hour, in minutes, e.g. "45 min". */
export const formatDuration = (minutes: number, language: Language): string => {
	if (minutes < 60) return new Intl.NumberFormat(language, { style: 'unit', unit: 'minute', unitDisplay: 'short' }).format(minutes);
	let format = durationFormatters.get(language);
	if (format === undefined) {
		format = new Intl.NumberFormat(language, { maximumFractionDigits: 1, style: 'unit', unit: 'hour', unitDisplay: 'short' });
		durationFormatters.set(language, format);
	}
	return format.format(minutes / 60);
};

/** A share as a percentage, e.g. "64 %" / "64 %". */
export const formatPercent = (ratio: number, language: Language): string => new Intl.NumberFormat(language, { maximumFractionDigits: 0, style: 'percent' }).format(ratio);
