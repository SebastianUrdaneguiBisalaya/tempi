import { fail, ok, type Result, type WeatherLocation, type WeatherProvider, weatherConditionsSchema } from '@tempi/core';
import { type FetchLike, isMeshlyError } from '@usemeshly/auth';
import { createOpenMeteoClient, type GeocodingLocation } from '@usemeshly/open-meteo';

/** How many places a city search offers. */
export const SEARCH_RESULTS = 8;

const CURRENT = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day', 'precipitation', 'weather_code', 'cloud_cover', 'wind_speed_10m', 'wind_direction_10m'] as const;

const DAILY = ['temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset'] as const;

/** Open-Meteo's failures as the `weather.*` keys the UI translates; the library's message (no URL, no key) is the detail. */
const failure = (error: unknown): Result<never> => {
	const detail = error instanceof Error ? error.message : String(error);
	if (isMeshlyError(error, 'rate_limited')) return fail('internal', 'weather.rateLimited', { detail });
	if (isMeshlyError(error, 'network_error', 'timeout')) return fail('internal', 'weather.offline', { detail });
	return fail('internal', 'weather.unavailable', { detail });
};

const instant = (unixSeconds: number | null | undefined): string | null => (unixSeconds === null || unixSeconds === undefined ? null : new Date(unixSeconds * 1000).toISOString());

/** The region that tells namesakes apart (`Lima, Peru`), without repeating the place's own name. */
const regionOf = (place: GeocodingLocation): string | null => {
	const parts = [place.admin1, place.country].filter((part): part is string => part !== undefined && part.trim() !== '' && part !== place.name);
	return parts.length === 0 ? null : [...new Set(parts)].join(', ');
};

const toLocation = (place: GeocodingLocation): WeatherLocation => ({ latitude: place.latitude, longitude: place.longitude, name: place.name, region: regionOf(place) });

/**
 * The weather port over Open-Meteo's free plan, which needs no key. Requests go through `fetch` (the main process's
 * network stack); the renderer never reaches Open-Meteo.
 */
export const createOpenMeteoWeather = (fetch: FetchLike): WeatherProvider => {
	const meteo = createOpenMeteoClient({ fetch, plan: 'free' });
	return {
		current: async location => {
			try {
				const forecast = await meteo.forecast({
					current: [...CURRENT],
					daily: [...DAILY],
					forecast_days: 1,
					latitude: location.latitude,
					longitude: location.longitude,
					timeformat: 'unixtime',
					// Today's high, low and sun times are the place's own day, not UTC's.
					timezone: 'auto',
				});
				const { current, daily } = forecast;
				const conditions = weatherConditionsSchema.safeParse({
					apparentTemperature: current.apparent_temperature,
					cloudCover: current.cloud_cover,
					high: daily.temperature_2m_max[0] ?? null,
					humidity: current.relative_humidity_2m,
					isDay: current.is_day === null ? null : current.is_day === 1,
					low: daily.temperature_2m_min[0] ?? null,
					precipitation: current.precipitation,
					sunrise: instant(daily.sunrise[0]),
					sunset: instant(daily.sunset[0]),
					temperature: current.temperature_2m,
					weatherCode: current.weather_code,
					windDirection: current.wind_direction_10m,
					windSpeed: current.wind_speed_10m,
				});
				if (conditions.success) return ok(conditions.data);
				return fail('internal', 'weather.unavailable', { detail: `Open-Meteo sent unusable weather: ${conditions.error.message}` });
			} catch (error) {
				return failure(error);
			}
		},
		searchLocations: async (query, language) => {
			try {
				return ok((await meteo.geocoding.search(query, { count: SEARCH_RESULTS, language })).map(toLocation));
			} catch (error) {
				return failure(error);
			}
		},
	};
};
