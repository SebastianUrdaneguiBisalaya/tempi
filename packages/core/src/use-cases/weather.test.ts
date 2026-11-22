import { describe, expect, test } from 'bun:test';
import { fail, ok, type Result } from '../domain/result';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { WeatherConditions, WeatherLocation } from '../domain/weather';
import type { WeatherProvider } from '../ports/weather-provider';
import { makeDeps } from './test-fakes';
import { getWeather, searchWeatherLocations, weatherTarget } from './weather';

const LIMA: WeatherLocation = { latitude: -12.04, longitude: -77.03, name: 'Lima', region: 'Lima, Peru' };
const CUSCO: WeatherLocation = { latitude: -13.52, longitude: -71.97, name: 'Cusco', region: 'Cusco, Peru' };

const CONDITIONS: WeatherConditions = {
	apparentTemperature: 20,
	cloudCover: 40,
	high: 22,
	humidity: 70,
	isDay: true,
	low: 16,
	precipitation: 0,
	sunrise: null,
	sunset: null,
	temperature: 19,
	weatherCode: 1,
	windDirection: 180,
	windSpeed: 10,
};

/** A provider that knows a few places and records what it was asked. */
const fakeProvider = (places: WeatherLocation[] = [LIMA, CUSCO]) => {
	const calls: string[] = [];
	const provider: WeatherProvider = {
		current: location => {
			calls.push(`current ${location.name}`);
			return Promise.resolve(ok(CONDITIONS));
		},
		searchLocations: (query, language) => {
			calls.push(`search ${query} ${language}`);
			return Promise.resolve(ok(places.filter(place => place.name.toLowerCase().startsWith(query.toLowerCase()))));
		},
	};
	return { calls, provider };
};

const depsWith = async (settings: { weatherEnabled?: boolean; weatherLocation?: WeatherLocation | null; language?: 'en' | 'es' } = {}, timeZone: string | null = 'America/Lima') => {
	const deps = makeDeps();
	const now = deps.clock.now().toISOString();
	await deps.settings.save({ ...DEFAULT_SETTINGS, ...settings, createdAt: now, updatedAt: now });
	if (timeZone !== null) await deps.profile.save({ avatar: null, country: 'PE', createdAt: now, firstName: 'Ana', lastName: 'Quispe', timeZone, updatedAt: now });
	return deps;
};

describe('weather', () => {
	test('shows the place picked in Settings without searching', async () => {
		const { calls, provider } = fakeProvider();
		const target = await weatherTarget(await depsWith({ weatherLocation: CUSCO }));
		expect(await getWeather(provider, target)).toEqual(ok({ conditions: CONDITIONS, location: CUSCO }));
		expect(calls).toEqual(['current Cusco']);
	});

	test('until a place is picked, proposes the city of the profile time zone, named in the app language', async () => {
		const { calls, provider } = fakeProvider();
		const target = await weatherTarget(await depsWith({ language: 'es' }));
		expect(target).toEqual({ enabled: true, language: 'es', location: null, proposedCity: 'Lima' });
		expect(await getWeather(provider, target)).toEqual(ok({ conditions: CONDITIONS, location: LIMA }));
		expect(calls).toEqual(['search Lima es', 'current Lima']);
	});

	test('switched off, nothing is requested', async () => {
		const { calls, provider } = fakeProvider();
		const target = await weatherTarget(await depsWith({ weatherEnabled: false, weatherLocation: CUSCO }));
		expect(await getWeather(provider, target)).toEqual(ok(null));
		expect(calls).toEqual([]);
	});

	test('no place to show: no profile, a zone that is no city, or a city nobody knows', async () => {
		const { calls, provider } = fakeProvider([]);
		expect(await getWeather(provider, await weatherTarget(await depsWith({}, null)))).toEqual(ok(null));
		expect(await getWeather(provider, await weatherTarget(await depsWith({}, 'Etc/UTC')))).toEqual(ok(null));
		expect(await getWeather(provider, await weatherTarget(await depsWith()))).toEqual(ok(null));
		expect(calls).toEqual(['search Lima en']);
	});

	test('a provider failure comes back as is', async () => {
		const failing: WeatherProvider = {
			current: () => Promise.resolve(fail('internal', 'weather.rateLimited')),
			searchLocations: (): Promise<Result<WeatherLocation[]>> => Promise.resolve(fail('internal', 'weather.offline')),
		};
		expect(await getWeather(failing, await weatherTarget(await depsWith({ weatherLocation: LIMA })))).toMatchObject({ error: { issues: [{ key: 'weather.rateLimited' }] }, ok: false });
		expect(await getWeather(failing, await weatherTarget(await depsWith()))).toMatchObject({ error: { issues: [{ key: 'weather.offline' }] }, ok: false });
	});

	test('a city search needs at least two characters', async () => {
		const { calls, provider } = fakeProvider();
		expect(await searchWeatherLocations(provider, 'en', ' cu ')).toEqual(ok([CUSCO]));
		expect(await searchWeatherLocations(provider, 'en', 'c')).toMatchObject({ error: { code: 'validation', issues: [{ key: 'validation.min' }] }, ok: false });
		expect(await searchWeatherLocations(provider, 'en', 42)).toMatchObject({ ok: false });
		expect(calls).toEqual(['search cu en']);
	});
});
