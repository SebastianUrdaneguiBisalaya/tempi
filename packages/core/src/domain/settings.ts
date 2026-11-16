import { z } from 'zod';
import { singletonTimestampsSchema } from './timestamps';

export const THEMES = ['system', 'light', 'dark'] as const;
export const LANGUAGES = ['en', 'es'] as const;
export const WEEK_STARTS = ['monday', 'sunday', 'saturday'] as const;
export const TIME_FORMATS = ['12h', '24h'] as const;

export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
export type WeekStart = (typeof WEEK_STARTS)[number];
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const settingsValuesSchema = z.object({
	/** Minutes, up to one day. */
	defaultEventDuration: z.number().int('validation.integer').min(1, 'validation.min').max(1440, 'validation.max'),
	language: z.enum(LANGUAGES),
	menuBarEnabled: z.boolean(),
	onboardingCompleted: z.boolean(),
	showWeekends: z.boolean(),
	showWeekNumbers: z.boolean(),
	theme: z.enum(THEMES),
	timeFormat: z.enum(TIME_FORMATS),
	weekStart: z.enum(WEEK_STARTS),
});

export const settingsPatchSchema = settingsValuesSchema.partial();

export type SettingsValues = z.output<typeof settingsValuesSchema>;
export type SettingsPatch = z.input<typeof settingsPatchSchema>;

/** App-wide preferences. There is one settings record per installation. */
export const settingsSchema = settingsValuesSchema.extend(singletonTimestampsSchema.shape);

export type Settings = z.output<typeof settingsSchema>;

export const DEFAULT_SETTINGS = {
	defaultEventDuration: 60,
	language: 'en',
	menuBarEnabled: false,
	onboardingCompleted: false,
	showWeekends: true,
	showWeekNumbers: false,
	theme: 'system',
	timeFormat: '24h',
	weekStart: 'monday',
} as const satisfies SettingsValues;
