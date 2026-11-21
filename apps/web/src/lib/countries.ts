import { isValidTimeZone, type Language } from '@tempi/core';
import { getAllCountries, getCountry, getCountryForTimezone } from 'countries-and-timezones';
import { hasFlag } from 'country-flag-icons';

export type CountryOption = {
	/** ISO 3166-1 alpha-2 code. */
	code: string;
	/** Name in the UI language, for display. */
	name: string;
	/** Accent-free name and code, so a search for "peru" finds "Perú". */
	keywords: string[];
};

/** The system's IANA time zone, e.g. `America/Lima`. */
export const systemTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The country a time zone belongs to, or null for zones without one (`UTC`). */
export const countryForTimeZone = (timeZone: string): string | null => getCountryForTimezone(timeZone)?.id ?? null;

/** The country's time zones that the platform can use, in the library's order (most populated first). */
export const countryTimeZones = (code: string): string[] => (getCountry(code)?.timezones ?? []).filter(isValidTimeZone);

const removeAccents = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '');

// Building and sorting ~250 localized names is wasteful on every render; the list only changes with the language.
const optionsByLanguage = new Map<Language, CountryOption[]>();

/** Countries with a flag and at least one time zone, named and sorted for the UI language. */
export const countryOptions = (language: Language): CountryOption[] => {
	const cached = optionsByLanguage.get(language);
	if (cached !== undefined) return cached;

	const names = new Intl.DisplayNames([language], { type: 'region' });
	const collator = new Intl.Collator(language);
	const options = Object.keys(getAllCountries())
		.filter(code => hasFlag(code) && countryTimeZones(code).length > 0)
		.map(code => {
			const name = names.of(code) ?? code;
			return { code, keywords: [code, removeAccents(name)], name };
		})
		.sort((a, b) => collator.compare(a.name, b.name));
	optionsByLanguage.set(language, options);
	return options;
};

const timeZoneNamePart = (timeZone: string, language: Language, style: Intl.DateTimeFormatOptions['timeZoneName']): string =>
	new Intl.DateTimeFormat(language, { timeZone, timeZoneName: style }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value ?? '';

/** e.g. "Eastern Time · New York (GMT-5)" / "hora del este · New York (GMT-5)". */
export const timeZoneLabel = (timeZone: string, language: Language): string => {
	const city = (timeZone.split('/').pop() ?? timeZone).replaceAll('_', ' ');
	return `${timeZoneNamePart(timeZone, language, 'longGeneric')} · ${city} (${timeZoneNamePart(timeZone, language, 'shortOffset')})`;
};

/** Offset like "GMT-5" for the zone, at this moment. */
export const timeZoneOffset = (timeZone: string, language: Language): string => timeZoneNamePart(timeZone, language, 'shortOffset');

/** The two lines of a time zone's column header: its country (or city when it has none) and its offset. */
export const timeZoneHeader = (timeZone: string, language: Language): { description: string; label: string } => {
	const code = countryForTimeZone(timeZone);
	const country = code === null ? null : (new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? null);
	const city = (timeZone.split('/').pop() ?? timeZone).replaceAll('_', ' ');
	return { description: timeZoneOffset(timeZone, language), label: country ?? city };
};
