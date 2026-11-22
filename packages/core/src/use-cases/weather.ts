import { ok, parseWith, type Result } from '../domain/result';
import type { Language } from '../domain/settings';
import { timeZoneCity, type Weather, type WeatherLocation, weatherLocationQuerySchema } from '../domain/weather';
import type { WeatherProvider } from '../ports/weather-provider';
import type { CoreDeps } from './deps';
import { getSettings } from './get-settings';

/** What to ask the provider for, read from storage: nothing when the integration is off. */
export type WeatherTarget = { enabled: false } | { enabled: true; language: Language; location: WeatherLocation | null; proposedCity: string | null };

/**
 * Reads where the weather is shown: the place picked in Settings or, until one is, the city of the profile's time zone.
 * Only reads storage, so it can run inside a transaction while the provider is called outside it.
 */
export const weatherTarget = async (deps: Pick<CoreDeps, 'clock' | 'profile' | 'settings'>): Promise<WeatherTarget> => {
	const settings = await getSettings(deps);
	if (!settings.weatherEnabled) return { enabled: false };
	const profile = await deps.profile.get();
	return {
		enabled: true,
		language: settings.language,
		location: settings.weatherLocation,
		proposedCity: settings.weatherLocation === null && profile !== null ? timeZoneCity(profile.timeZone) : null,
	};
};

/** The current weather for `target`; null when the integration is off or there is no place to show it for. */
export const getWeather = async (provider: WeatherProvider, target: WeatherTarget): Promise<Result<Weather | null>> => {
	if (!target.enabled) return ok(null);
	let location = target.location;
	if (location === null && target.proposedCity !== null) {
		const found = await provider.searchLocations(target.proposedCity, target.language);
		if (!found.ok) return found;
		location = found.value[0] ?? null;
	}
	if (location === null) return ok(null);
	const conditions = await provider.current(location);
	return conditions.ok ? ok({ conditions: conditions.value, location }) : conditions;
};

/** Places matching a search typed in Settings, named in the app's language. */
export const searchWeatherLocations = (provider: WeatherProvider, language: Language, input: unknown): Promise<Result<WeatherLocation[]>> => {
	const query = parseWith(weatherLocationQuerySchema, input);
	return query.ok ? provider.searchLocations(query.value, language) : Promise.resolve(query);
};
