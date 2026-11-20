import type { Locale } from './i18n';

// The same formats as apps/web `lib/date-format.ts`, in the visitor's time zone and the language's own clock.

/** A length of time in hours, e.g. "12.5 hr" / "12,5 h"; under an hour, in minutes, e.g. "45 min". */
export const formatDuration = (minutes: number, locale: Locale): string =>
	minutes < 60
		? new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'short' }).format(minutes)
		: new Intl.NumberFormat(locale, { maximumFractionDigits: 1, style: 'unit', unit: 'hour', unitDisplay: 'short' }).format(minutes / 60);

export const formatPercent = (ratio: number, locale: Locale): string => new Intl.NumberFormat(locale, { maximumFractionDigits: 0, style: 'percent' }).format(ratio);

/** Weekday, month and day, e.g. "Tue, Nov 25" / "mar, 25 nov". */
export const formatShortDate = (date: Date, locale: Locale): string => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', weekday: 'short' }).format(date);

/** A start–end span collapsed by Intl, e.g. "9:00 – 10:30 AM". */
export const formatTimeRange = (start: Date, end: Date, locale: Locale): string => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).formatRange(start, end);

/** The zone's offset name at `date`, e.g. "GMT-5"; the visitor's own zone when `timeZone` is left out. */
export const formatTimeZoneOffset = (date: Date, locale: Locale, timeZone?: string): string =>
	new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'shortOffset' }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value ?? timeZone ?? '';
