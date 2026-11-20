import type { Language } from '@tempi/core';
import * as chrono from 'chrono-node';

export type QuickAddOptions = {
	/** The profile's country (ISO 3166 alpha-2): for English, whether `3/12` is day-first or month-first. */
	country: string | null;
	/** Minutes, for a timed event without an end or a duration. */
	defaultDuration: number;
	language: Language;
	now: Temporal.Instant;
	/** The profile's time zone: relative days ("tomorrow") and every time are read in it. */
	timeZone: string;
};

/** A new event worked out from typed text, as UTC instants like any other draft; all-day ends are exclusive. */
export type QuickAddEvent = { allDay: boolean; endAt: string; startAt: string; title: string };

// English-speaking places that write the month first (`3/12` is March 12); the rest of the English-speaking world writes the day first.
const MONTH_FIRST_COUNTRIES = new Set(['AS', 'FM', 'GU', 'MH', 'MP', 'PH', 'PR', 'PW', 'UM', 'US', 'VI']);

const parserFor = (language: Language, country: string | null): chrono.Chrono => {
	if (language === 'es') return chrono.es.casual;
	return country === null || MONTH_FIRST_COUNTRIES.has(country) ? chrono.en.casual : chrono.en.GB;
};

// "1h", "2 hours", "30 min", "1h 30m", "90 minutos". Chrono would read these as clock times, so they are taken out first.
// Not after "in"/"en"/"dentro de": those are relative times ("in 30 min") that chrono reads itself.
const DURATION =
	/(?<![\p{L}\p{N}])(?<!\b(?:in|en|de)\s)(?:(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hours?|horas?)(?:\s*(\d+)\s*(?:m|min|mins|minutes?|minutos?))?|(\d+)\s*(?:m|min|mins|minutes?|minutos?))(?![\p{L}\p{N}])/iu;

const takeDuration = (text: string): { minutes: number | null; rest: string } => {
	const match = DURATION.exec(text);
	if (match === null) return { minutes: null, rest: text };
	const [whole, hours, extraMinutes, minutesOnly] = match;
	const minutes = hours === undefined ? Number(minutesOnly) : Math.round(Number(hours.replace(',', '.')) * 60) + Number(extraMinutes ?? 0);
	return { minutes: minutes > 0 ? minutes : null, rest: `${text.slice(0, match.index)} ${text.slice(match.index + whole.length)}` };
};

// Words left hanging once the date is taken out ("Lunch at", "Cena el").
const CONNECTORS = new Set(['a', 'at', 'by', 'de', 'del', 'el', 'en', 'for', 'from', 'la', 'las', 'los', 'on', 'para']);

const cleanTitle = (text: string): string => {
	const words = text.split(/\s+/).filter(word => word !== '');
	while (words.length > 0 && CONNECTORS.has((words.at(-1) ?? '').toLowerCase())) words.pop();
	while (words.length > 0 && CONNECTORS.has((words[0] ?? '').toLowerCase())) words.shift();
	return words.join(' ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '');
};

const plainDate = (components: chrono.ParsedComponents): Temporal.PlainDate =>
	Temporal.PlainDate.from({ day: components.get('day') ?? 1, month: components.get('month') ?? 1, year: components.get('year') ?? 1970 });

const zoned = (components: chrono.ParsedComponents, timeZone: string): Temporal.ZonedDateTime =>
	plainDate(components).toZonedDateTime({ plainTime: Temporal.PlainTime.from({ hour: components.get('hour') ?? 0, minute: components.get('minute') ?? 0 }), timeZone });

/**
 * Reads a new event from plain English or Spanish ("Dentista mañana 4pm 1h", "Lunch friday at noon"): the first date
 * in the text, an optional duration, and the rest as the title. Without a time it is all-day. Null when there is no date.
 */
export const parseQuickAdd = (text: string, { country, defaultDuration, language, now, timeZone }: QuickAddOptions): QuickAddEvent | null => {
	const { minutes, rest } = takeDuration(text);
	// Chrono works out "tomorrow" and the times from this offset; the result is then rebuilt in the zone itself, so a
	// DST change between now and the event doesn't shift it.
	const reference = { instant: new Date(now.epochMilliseconds), timezone: now.toZonedDateTimeISO(timeZone).offsetNanoseconds / 60e9 };
	const [result] = parserFor(language, country).parse(rest, reference, { forwardDate: true });
	if (result === undefined) return null;

	const title = cleanTitle(`${rest.slice(0, result.index)} ${rest.slice(result.index + result.text.length)}`);
	if (!result.start.isCertain('hour')) {
		const start = plainDate(result.start);
		const resultEnd = result.end ?? null;
		const lastDay = resultEnd === null ? start : plainDate(resultEnd);
		const end = Temporal.PlainDate.compare(lastDay, start) > 0 ? lastDay.add({ days: 1 }) : start.add({ days: 1 });
		return { allDay: true, endAt: end.toZonedDateTime({ timeZone }).toInstant().toString(), startAt: start.toZonedDateTime({ timeZone }).toInstant().toString(), title };
	}

	const start = zoned(result.start, timeZone);
	const resultEnd = result.end ?? null;
	const parsedEnd = resultEnd?.isCertain('hour') ? zoned(resultEnd, timeZone) : null;
	const end = minutes !== null ? start.add({ minutes }) : parsedEnd !== null && Temporal.ZonedDateTime.compare(parsedEnd, start) > 0 ? parsedEnd : start.add({ minutes: defaultDuration });
	return { allDay: false, endAt: end.toInstant().toString(), startAt: start.toInstant().toString(), title };
};
