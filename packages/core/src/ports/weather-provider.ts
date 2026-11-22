import type { Result } from '../domain/result';
import type { Language } from '../domain/settings';
import type { WeatherConditions, WeatherLocation } from '../domain/weather';

/**
 * Where current weather and place names come from (Open-Meteo's free plan today). Failures come back as a failed
 * `Result` with a `weather.*` key, never thrown.
 */
export type WeatherProvider = {
	current: (location: WeatherLocation) => Promise<Result<WeatherConditions>>;
	/** Places matching `query`, best first, named in `language` when possible; empty when nothing matches. */
	searchLocations: (query: string, language: Language) => Promise<Result<WeatherLocation[]>>;
};
