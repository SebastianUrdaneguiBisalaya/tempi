import { z } from 'zod';
import { singletonTimestampsSchema } from './timestamps';

export const THEMES = ['system', 'light', 'dark'] as const;
export const LANGUAGES = ['en', 'es'] as const;
export const WEEK_STARTS = ['monday', 'sunday', 'saturday'] as const;
export const TIME_FORMATS = ['12h', '24h'] as const;
/** The UI sounds a user can pick: the built-in presets of `@usesounds` (web checks each one is a preset), so no audio files ship. */
export const UI_SOUNDS = ['tick', 'pop', 'tap', 'toggle', 'success', 'error'] as const;

export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
export type WeekStart = (typeof WEEK_STARTS)[number];
export type TimeFormat = (typeof TIME_FORMATS)[number];
export type UiSound = (typeof UI_SOUNDS)[number];

export const settingsValuesSchema = z.object({
	/** The all-day lane above the week/day grid shows at most two rows. */
	allDayCollapsed: z.boolean(),
	/** Minutes, up to one day. */
	defaultEventDuration: z.number().int('validation.integer').min(1, 'validation.min').max(1440, 'validation.max'),
	language: z.enum(LANGUAGES),
	menuBarEnabled: z.boolean(),
	/** Lets dictation and voice use the microphone. The OS may still deny it. */
	microphoneEnabled: z.boolean(),
	/** Shows reminders as native notifications. The OS may still block them. */
	notificationsEnabled: z.boolean(),
	onboardingCompleted: z.boolean(),
	/** Starts Tempi hidden when the user logs in to the computer, so reminders and the menu bar keep working after a restart. */
	openAtLoginEnabled: z.boolean(),
	showWeekends: z.boolean(),
	showWeekNumbers: z.boolean(),
	/** The sound every button plays while `soundsEnabled` is on. */
	sound: z.enum(UI_SOUNDS),
	/** Plays a sound on every button press. Off silences the whole app. */
	soundsEnabled: z.boolean(),
	theme: z.enum(THEMES),
	timeFormat: z.enum(TIME_FORMATS),
	/** The guided tour of the main screen was finished or dismissed. Replaying it doesn't change this. */
	tourCompleted: z.boolean(),
	weekStart: z.enum(WEEK_STARTS),
});

export const settingsPatchSchema = settingsValuesSchema.partial();

export type SettingsValues = z.output<typeof settingsValuesSchema>;
export type SettingsPatch = z.input<typeof settingsPatchSchema>;

/** App-wide preferences. There is one settings record per installation. */
export const settingsSchema = settingsValuesSchema.extend(singletonTimestampsSchema.shape);

export type Settings = z.output<typeof settingsSchema>;

export const DEFAULT_SETTINGS = {
	allDayCollapsed: false,
	defaultEventDuration: 60,
	language: 'en',
	menuBarEnabled: false,
	microphoneEnabled: true,
	notificationsEnabled: true,
	onboardingCompleted: false,
	openAtLoginEnabled: false,
	showWeekends: true,
	showWeekNumbers: false,
	sound: 'tick',
	soundsEnabled: true,
	theme: 'system',
	timeFormat: '24h',
	tourCompleted: false,
	weekStart: 'monday',
} as const satisfies SettingsValues;

const isLanguage = (value: string): value is Language => (LANGUAGES as readonly string[]).includes(value);

/**
 * The first supported language among BCP 47 locales in preference order (`es-PE` → `es`), or the default.
 * Feed it the OS or browser preferences (`navigator.languages`, `app.getPreferredSystemLanguages()`).
 */
export const resolveLanguage = (locales: readonly string[]): Language => {
	for (const locale of locales) {
		const base = locale.split(/[-_]/)[0]?.toLowerCase() ?? '';
		if (isLanguage(base)) return base;
	}
	return DEFAULT_SETTINGS.language;
};
