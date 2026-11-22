import { type CoreDeps, getSettings, getWeather, ok, searchWeatherLocations, type WeatherProvider, weatherTarget } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handleRequest } from './handle';

/**
 * `weather:*`. Settings are read in a transaction; Open-Meteo is called after it, so a slow answer never holds the
 * database queue.
 */
export const registerWeatherHandlers = (context: HandlerContext, deps: CoreDeps, provider: WeatherProvider): void => {
	handleRequest(context, CHANNELS.weather.current, async () => {
		const target = await context.transaction(async () => ok(await weatherTarget(deps)));
		return target.ok ? getWeather(provider, target.value) : target;
	});
	handleRequest(context, CHANNELS.weather.searchLocations, async query => {
		const settings = await context.transaction(async () => ok(await getSettings(deps)));
		return settings.ok ? searchWeatherLocations(provider, settings.value.language, query) : settings;
	});
};
