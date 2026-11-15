import { fail, ok, type Result } from './result';

export const THEMES = ['system', 'light', 'dark'] as const;
export const LANGUAGES = ['en', 'es'] as const;
export const WEEK_STARTS = ['monday', 'sunday', 'saturday'] as const;
export const TIME_FORMATS = ['12h', '24h'] as const;

export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
export type WeekStart = (typeof WEEK_STARTS)[number];
export type TimeFormat = (typeof TIME_FORMATS)[number];

export type SettingsValues = {
	/** Minutes. */
	defaultEventDuration: number;
	language: Language;
	menuBarEnabled: boolean;
	onboardingCompleted: boolean;
	showWeekends: boolean;
	showWeekNumbers: boolean;
	theme: Theme;
	timeFormat: TimeFormat;
	weekStart: WeekStart;
};

/** App-wide preferences. There is one settings record per installation. */
export type Settings = SettingsValues & {
	createdAt: string;
	updatedAt: string;
};

export type SettingsPatch = Partial<SettingsValues>;

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

const MAX_EVENT_DURATION = 24 * 60;

export const validateSettingsValues = (values: SettingsValues): Result<SettingsValues> => {
	if (!THEMES.includes(values.theme)) return fail('validation', 'Unknown theme', 'theme');
	if (!LANGUAGES.includes(values.language)) return fail('validation', 'Unsupported language', 'language');
	if (!WEEK_STARTS.includes(values.weekStart)) return fail('validation', 'Unknown week start', 'weekStart');
	if (!TIME_FORMATS.includes(values.timeFormat)) return fail('validation', 'Time format must be 12h or 24h', 'timeFormat');
	const duration = values.defaultEventDuration;
	if (!Number.isInteger(duration) || duration <= 0 || duration > MAX_EVENT_DURATION) {
		return fail('validation', 'Default event duration must be between 1 and 1440 minutes', 'defaultEventDuration');
	}
	return ok(values);
};
