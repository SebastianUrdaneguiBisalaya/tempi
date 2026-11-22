import { describe, expect, test } from 'bun:test';
import type { FetchLike } from '@usemeshly/auth';
import { createOpenMeteoWeather, SEARCH_RESULTS } from './open-meteo-weather';

const LIMA = { latitude: -12.04, longitude: -77.03, name: 'Lima', region: 'Lima, Peru' };

const json = (body: object, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status }));

const meta = { generationtime_ms: 0.1, latitude: -12.04, longitude: -77.03, timezone: 'America/Lima', timezone_abbreviation: 'GMT-5', utc_offset_seconds: -18000 };

// Forecast answer for `current` and `daily` with `timeformat=unixtime`, as Open-Meteo sends it.
const FORECAST = {
	...meta,
	current: {
		apparent_temperature: 20.1,
		cloud_cover: 75,
		interval: 900,
		is_day: 1,
		precipitation: 0.2,
		relative_humidity_2m: 81,
		temperature_2m: 19.4,
		time: 1795276800,
		weather_code: 61,
		wind_direction_10m: 200,
		wind_speed_10m: 14.3,
	},
	current_units: {
		apparent_temperature: '°C',
		cloud_cover: '%',
		interval: 'seconds',
		is_day: '',
		precipitation: 'mm',
		relative_humidity_2m: '%',
		temperature_2m: '°C',
		time: 'unixtime',
		weather_code: 'wmo code',
		wind_direction_10m: '°',
		wind_speed_10m: 'km/h',
	},
	daily: { sunrise: [1795258380], sunset: [1795304580], temperature_2m_max: [22.3], temperature_2m_min: [16.8], time: [1795237200] },
	daily_units: { sunrise: 'unixtime', sunset: 'unixtime', temperature_2m_max: '°C', temperature_2m_min: '°C', time: 'unixtime' },
};

const answering = (respond: (url: URL) => Promise<Response>) => {
	const urls: URL[] = [];
	const fetch: FetchLike = url => {
		const parsed = new URL(url);
		urls.push(parsed);
		return respond(parsed);
	};
	return { fetch, urls };
};

describe('Open-Meteo weather', () => {
	test('asks the free plan for the current weather and today, and maps it to metric conditions', async () => {
		const { fetch, urls } = answering(() => json(FORECAST));
		expect(await createOpenMeteoWeather(fetch).current(LIMA)).toEqual({
			ok: true,
			value: {
				apparentTemperature: 20.1,
				cloudCover: 75,
				high: 22.3,
				humidity: 81,
				isDay: true,
				low: 16.8,
				precipitation: 0.2,
				sunrise: new Date(1795258380 * 1000).toISOString(),
				sunset: new Date(1795304580 * 1000).toISOString(),
				temperature: 19.4,
				weatherCode: 61,
				windDirection: 200,
				windSpeed: 14.3,
			},
		});
		const [url] = urls;
		expect(url?.host).toBe('api.open-meteo.com');
		expect(url?.searchParams.get('latitude')).toBe('-12.04');
		expect(url?.searchParams.get('timezone')).toBe('auto');
		expect(url?.searchParams.has('apikey')).toBe(false);
	});

	test('keeps values Open-Meteo has no data for as null', async () => {
		const { fetch } = answering(() => json({ ...FORECAST, current: { ...FORECAST.current, is_day: null, temperature_2m: null }, daily: { ...FORECAST.daily, sunrise: [null] } }));
		expect(await createOpenMeteoWeather(fetch).current(LIMA)).toMatchObject({ ok: true, value: { isDay: null, sunrise: null, temperature: null } });
	});

	test('searches places in the app language and names their region', async () => {
		const { fetch, urls } = answering(() =>
			json({
				generationtime_ms: 0.2,
				results: [
					{ admin1: 'Lima', country: 'Peru', country_code: 'PE', id: 3936456, latitude: -12.04318, longitude: -77.02824, name: 'Lima' },
					{ admin1: 'Ohio', country: 'United States', id: 4517009, latitude: 40.74255, longitude: -84.10523, name: 'Lima' },
					{ id: 1, latitude: 0, longitude: 0, name: 'Nowhere' },
				],
			})
		);
		expect(await createOpenMeteoWeather(fetch).searchLocations('Lima', 'es')).toEqual({
			ok: true,
			value: [
				{ latitude: -12.04318, longitude: -77.02824, name: 'Lima', region: 'Peru' },
				{ latitude: 40.74255, longitude: -84.10523, name: 'Lima', region: 'Ohio, United States' },
				{ latitude: 0, longitude: 0, name: 'Nowhere', region: null },
			],
		});
		expect(urls[0]?.host).toBe('geocoding-api.open-meteo.com');
		expect(urls[0]?.searchParams.get('language')).toBe('es');
		expect(urls[0]?.searchParams.get('count')).toBe(String(SEARCH_RESULTS));
	});

	test('nothing found is an empty list', async () => {
		const { fetch } = answering(() => json({ generationtime_ms: 0.1 }));
		expect(await createOpenMeteoWeather(fetch).searchLocations('Xyzzy', 'en')).toEqual({ ok: true, value: [] });
	});

	test('reports a rate limit, no connection and any other failure with their own keys', async () => {
		const key = async (fetch: FetchLike) => {
			const result = await createOpenMeteoWeather(fetch).current(LIMA);
			return result.ok ? null : result.error.issues[0]?.key;
		};
		expect(await key(answering(() => json({ error: true, reason: 'Daily API request limit exceeded' }, 429)).fetch)).toBe('weather.rateLimited');
		expect(await key(() => Promise.reject(new TypeError('net::ERR_INTERNET_DISCONNECTED')))).toBe('weather.offline');
		expect(await key(answering(() => json({ error: true, reason: 'Boom' }, 500)).fetch)).toBe('weather.unavailable');
		expect(await key(answering(() => json({ ...meta })).fetch)).toBe('weather.unavailable');
	});
});
