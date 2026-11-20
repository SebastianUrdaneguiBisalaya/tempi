import { z } from 'zod';
import { singletonTimestampsSchema } from './timestamps';
import { timeZoneSchema } from './values';

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

/** How many extra hour columns the day and week views can show. */
export const MAX_SECONDARY_TIME_ZONES = 2;

/** Weekdays numbered like `Temporal.PlainDate#dayOfWeek`: 1 is Monday, 7 is Sunday. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** A wall-clock time of day, `HH:MM` in 24-hour form, so times compare as text. */
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation.invalid_format');

/** One range of hours for the chosen weekdays, in the profile's time zone. Disabled, it marks nothing. */
export const workingHoursSchema = z
	.object({
		days: z
			.array(z.number().int('validation.integer').min(1, 'validation.min').max(7, 'validation.max'))
			.min(1, 'settings.workingDays')
			.refine(days => new Set(days).size === days.length, 'settings.workingDays')
			.readonly(),
		enabled: z.boolean(),
		end: timeOfDaySchema,
		start: timeOfDaySchema,
	})
	.refine(hours => hours.end > hours.start, { message: 'settings.workingHoursEnd', path: ['end'] });

export type WorkingHours = z.output<typeof workingHoursSchema>;

export const settingsValuesSchema = z.object({
	/** The all-day lane above the week/day grid shows at most two rows. */
	allDayCollapsed: z.boolean(),
	/** Minutes, up to one day. */
	defaultEventDuration: z.number().int('validation.integer').min(1, 'validation.min').max(1440, 'validation.max'),
	/** Shows how many of today's events are left on the app icon (Dock, taskbar or launcher). */
	iconBadgeEnabled: z.boolean(),
	language: z.enum(LANGUAGES),
	menuBarEnabled: z.boolean(),
	/** Lets dictation and voice use the microphone. The OS may still deny it. */
	microphoneEnabled: z.boolean(),
	/** Shows reminders as native notifications. The OS may still block them. */
	notificationsEnabled: z.boolean(),
	onboardingCompleted: z.boolean(),
	/** Starts Tempi hidden when the user logs in to the computer, so reminders and the menu bar keep working after a restart. */
	openAtLoginEnabled: z.boolean(),
	/** IANA zones shown as extra hour columns in the day and week views, in order. */
	secondaryTimeZones: z
		.array(timeZoneSchema)
		.max(MAX_SECONDARY_TIME_ZONES, 'settings.secondaryTimeZones')
		.refine(zones => new Set(zones).size === zones.length, 'settings.secondaryTimeZones')
		.readonly(),
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
	workingHours: workingHoursSchema,
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
	iconBadgeEnabled: true,
	language: 'en',
	menuBarEnabled: false,
	microphoneEnabled: true,
	notificationsEnabled: true,
	onboardingCompleted: false,
	openAtLoginEnabled: false,
	secondaryTimeZones: [],
	showWeekends: true,
	showWeekNumbers: false,
	sound: 'tick',
	soundsEnabled: true,
	theme: 'system',
	timeFormat: '24h',
	tourCompleted: false,
	weekStart: 'monday',
	workingHours: { days: [1, 2, 3, 4, 5], enabled: false, end: '18:00', start: '09:00' },
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
