import { z } from 'zod';
import { utcInstantSchema } from './values';

/** A place the weather is shown for: one the user picked in Settings, or the city of their time zone. */
export const weatherLocationSchema = z.object({
	latitude: z.number().min(-90, 'validation.min').max(90, 'validation.max'),
	longitude: z.number().min(-180, 'validation.min').max(180, 'validation.max'),
	name: z.string().trim().min(1, 'validation.required').max(200, 'validation.max'),
	/** Where the place is, for telling namesakes apart (e.g. `Lima, Peru`); null when unknown. */
	region: z.string().trim().min(1, 'validation.required').max(200, 'validation.max').nullable(),
});

export type WeatherLocation = z.output<typeof weatherLocationSchema>;

/** A city search typed in Settings. */
export const weatherLocationQuerySchema = z.string().trim().min(2, 'validation.min').max(100, 'validation.max');

const measure = z.number().nullable();

/**
 * The current weather at a location, in metric units (°C, km/h, mm, %). A provider may have no value for a field
 * (null); `weatherCode` is a WMO 4677 code.
 */
export const weatherConditionsSchema = z.object({
	apparentTemperature: measure,
	cloudCover: measure,
	/** Today's highest and lowest temperature. */
	high: measure,
	humidity: measure,
	isDay: z.boolean().nullable(),
	low: measure,
	/** Over the last hour. */
	precipitation: measure,
	sunrise: utcInstantSchema.nullable(),
	sunset: utcInstantSchema.nullable(),
	temperature: measure,
	weatherCode: z.number().int().nullable(),
	/** Degrees the wind comes from, clockwise from north. */
	windDirection: measure,
	windSpeed: measure,
});

export type WeatherConditions = z.output<typeof weatherConditionsSchema>;

export const weatherSchema = z.object({ conditions: weatherConditionsSchema, location: weatherLocationSchema });

export type Weather = z.output<typeof weatherSchema>;

/** The scenes the sidebar can paint, named like `@useweather`'s conditions. */
export const WEATHER_SCENE_CONDITIONS = [
	'clear',
	'partly-cloudy',
	'cloudy',
	'overcast',
	'fog',
	'drizzle',
	'rain',
	'heavy-rain',
	'thunderstorm',
	'snow',
	'heavy-snow',
	'sleet',
	'hail',
	'wind',
] as const;

export type WeatherSceneCondition = (typeof WEATHER_SCENE_CONDITIONS)[number];

export type WeatherTimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** What the background paints: `intensity` from 0 to 1, `wind` from -1 (to the left) to 1 (to the right). */
export type WeatherScene = { condition: WeatherSceneCondition; intensity: number; timeOfDay: WeatherTimeOfDay; wind: number };

/** WMO 4677 weather codes (as Open-Meteo reports them) to scenes; a code missing here paints a clear sky. */
const SCENE_BY_CODE: Record<number, WeatherSceneCondition> = {
	0: 'clear',
	1: 'partly-cloudy',
	2: 'cloudy',
	3: 'overcast',
	45: 'fog',
	48: 'fog',
	51: 'drizzle',
	53: 'drizzle',
	55: 'drizzle',
	56: 'sleet',
	57: 'sleet',
	61: 'rain',
	63: 'rain',
	65: 'heavy-rain',
	66: 'sleet',
	67: 'sleet',
	71: 'snow',
	73: 'snow',
	75: 'heavy-snow',
	77: 'snow',
	80: 'rain',
	81: 'rain',
	82: 'heavy-rain',
	85: 'snow',
	86: 'heavy-snow',
	95: 'thunderstorm',
	96: 'hail',
	99: 'hail',
};

/** From this speed (km/h, a strong breeze) a dry sky is painted as windy. */
const WINDY_KMH = 40;
/** The speed (km/h) at which the drift reaches its maximum. */
const FULL_DRIFT_KMH = 50;
/** Precipitation (mm in the last hour) at which rain or snow is at its densest. */
const FULL_PRECIPITATION_MM = 6;
/** How long dawn and dusk last around sunrise and sunset. */
const TWILIGHT_BEFORE_MS = 30 * 60 * 1000;
const TWILIGHT_AFTER_MS = 45 * 60 * 1000;

const WET = new Set<WeatherSceneCondition>(['drizzle', 'rain', 'heavy-rain', 'thunderstorm', 'snow', 'heavy-snow', 'sleet', 'hail']);
const DRY = new Set<WeatherSceneCondition>(['clear', 'partly-cloudy', 'cloudy']);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const conditionOf = (conditions: WeatherConditions): WeatherSceneCondition => {
	const condition = (conditions.weatherCode === null ? undefined : SCENE_BY_CODE[conditions.weatherCode]) ?? 'clear';
	return DRY.has(condition) && (conditions.windSpeed ?? 0) >= WINDY_KMH ? 'wind' : condition;
};

const timeOfDayOf = (conditions: WeatherConditions, now: Date): WeatherTimeOfDay => {
	const at = now.getTime();
	const sunrise = conditions.sunrise === null ? null : Date.parse(conditions.sunrise);
	const sunset = conditions.sunset === null ? null : Date.parse(conditions.sunset);
	if (sunrise !== null && at >= sunrise - TWILIGHT_BEFORE_MS && at <= sunrise + TWILIGHT_AFTER_MS) return 'dawn';
	if (sunset !== null && at >= sunset - TWILIGHT_AFTER_MS && at <= sunset + TWILIGHT_BEFORE_MS) return 'dusk';
	if (conditions.isDay !== null) return conditions.isDay ? 'day' : 'night';
	return sunrise !== null && sunset !== null && at > sunrise && at < sunset ? 'day' : 'night';
};

const intensityOf = (condition: WeatherSceneCondition, conditions: WeatherConditions): number => {
	// Rain and snow get denser with precipitation; clouds with cover. A shower always shows some drops.
	if (WET.has(condition)) return clamp(0.25 + (conditions.precipitation ?? 0) / FULL_PRECIPITATION_MM, 0.25, 1);
	return conditions.cloudCover === null ? 0.5 : clamp(conditions.cloudCover / 100, 0.1, 1);
};

const windOf = (conditions: WeatherConditions): number => {
	if (conditions.windSpeed === null || conditions.windDirection === null) return 0;
	// The direction is where the wind comes from: a west wind (270°) blows to the right of the screen.
	const eastward = -Math.sin((conditions.windDirection * Math.PI) / 180);
	const drift = clamp((eastward * conditions.windSpeed) / FULL_DRIFT_KMH, -1, 1);
	// Rounded so a tiny change in the reading doesn't move the scene.
	return Math.round(drift * 100) / 100 || 0;
};

/** How the background paints `conditions` at `now`: the scene, the light of the hour, how dense, and the wind. */
export const weatherScene = (conditions: WeatherConditions, now: Date): WeatherScene => {
	const condition = conditionOf(conditions);
	return { condition, intensity: intensityOf(condition, conditions), timeOfDay: timeOfDayOf(conditions, now), wind: windOf(conditions) };
};

// The regions IANA names zones after; others (`Etc/UTC`, `UTC`) aren't places.
const ZONE_REGIONS = new Set(['Africa', 'America', 'Antarctica', 'Asia', 'Atlantic', 'Australia', 'Europe', 'Indian', 'Pacific']);

/** The city an IANA zone is named after (`America/Argentina/Buenos_Aires` → `Buenos Aires`), or null. */
export const timeZoneCity = (timeZone: string): string | null => {
	const segments = timeZone.split('/');
	const [region] = segments;
	const city = segments.at(-1);
	if (segments.length < 2 || region === undefined || !ZONE_REGIONS.has(region) || city === undefined) return null;
	return city.replaceAll('_', ' ');
};
