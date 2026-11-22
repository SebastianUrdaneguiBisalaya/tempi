import { describe, expect, test } from 'bun:test';
import { timeZoneCity, type WeatherConditions, type WeatherSceneCondition, weatherScene } from './weather';

const NOON = new Date('2026-11-21T17:00:00.000Z');

const conditions = (overrides: Partial<WeatherConditions> = {}): WeatherConditions => ({
	apparentTemperature: 20,
	cloudCover: 40,
	high: 22,
	humidity: 70,
	isDay: true,
	low: 16,
	precipitation: 0,
	sunrise: '2026-11-21T10:30:00.000Z',
	sunset: '2026-11-21T23:30:00.000Z',
	temperature: 19,
	weatherCode: 0,
	windDirection: 0,
	windSpeed: 0,
	...overrides,
});

describe('weather scene', () => {
	test.each<[number | null, WeatherSceneCondition]>([
		[0, 'clear'],
		[2, 'cloudy'],
		[3, 'overcast'],
		[45, 'fog'],
		[53, 'drizzle'],
		[63, 'rain'],
		[82, 'heavy-rain'],
		[66, 'sleet'],
		[73, 'snow'],
		[86, 'heavy-snow'],
		[95, 'thunderstorm'],
		[99, 'hail'],
		[42, 'clear'],
		[null, 'clear'],
	])('paints WMO code %p as %s', (weatherCode, condition) => {
		expect(weatherScene(conditions({ weatherCode }), NOON).condition).toBe(condition);
	});

	test('a strong wind turns a dry sky windy, but never a wet one', () => {
		expect(weatherScene(conditions({ weatherCode: 1, windSpeed: 45 }), NOON).condition).toBe('wind');
		expect(weatherScene(conditions({ weatherCode: 63, windSpeed: 45 }), NOON).condition).toBe('rain');
	});

	test('follows the sun: dawn and dusk around sunrise and sunset, day between, night after', () => {
		const at = (iso: string, isDay: boolean | null = null) => weatherScene(conditions({ isDay }), new Date(iso)).timeOfDay;
		expect(at('2026-11-21T10:10:00.000Z')).toBe('dawn');
		expect(at('2026-11-21T11:10:00.000Z')).toBe('dawn');
		expect(at('2026-11-21T17:00:00.000Z', true)).toBe('day');
		expect(at('2026-11-21T23:00:00.000Z')).toBe('dusk');
		expect(at('2026-11-22T03:00:00.000Z', false)).toBe('night');
		// Without the provider's day flag, the sun times alone decide.
		expect(at('2026-11-21T17:00:00.000Z')).toBe('day');
		expect(weatherScene(conditions({ isDay: false, sunrise: null, sunset: null }), NOON).timeOfDay).toBe('night');
	});

	test('rain gets denser with precipitation and clouds with cover, within 0 to 1', () => {
		expect(weatherScene(conditions({ precipitation: 0, weatherCode: 61 }), NOON).intensity).toBe(0.25);
		expect(weatherScene(conditions({ precipitation: 3, weatherCode: 63 }), NOON).intensity).toBe(0.75);
		expect(weatherScene(conditions({ precipitation: 30, weatherCode: 65 }), NOON).intensity).toBe(1);
		expect(weatherScene(conditions({ cloudCover: 90, weatherCode: 3 }), NOON).intensity).toBe(0.9);
		expect(weatherScene(conditions({ cloudCover: null }), NOON).intensity).toBe(0.5);
	});

	test('wind drifts the way it blows: a west wind to the right, an east wind to the left, none without data', () => {
		expect(weatherScene(conditions({ windDirection: 270, windSpeed: 25 }), NOON).wind).toBe(0.5);
		expect(weatherScene(conditions({ windDirection: 90, windSpeed: 100 }), NOON).wind).toBe(-1);
		expect(weatherScene(conditions({ windDirection: 0, windSpeed: 30 }), NOON).wind).toBe(0);
		expect(weatherScene(conditions({ windDirection: null, windSpeed: 30 }), NOON).wind).toBe(0);
	});
});

describe('time zone city', () => {
	test.each([
		['America/Lima', 'Lima'],
		['America/Argentina/Buenos_Aires', 'Buenos Aires'],
		['Europe/Madrid', 'Madrid'],
		['Etc/UTC', null],
		['UTC', null],
	])('%s → %p', (zone, city) => {
		expect(timeZoneCity(zone)).toBe(city);
	});
});
