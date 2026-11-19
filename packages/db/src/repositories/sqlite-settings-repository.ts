import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { type Settings, type SettingsRepository, settingsSchema } from '@tempi/core';
import { z } from 'zod';
import { booleanColumn, type DomainFields, defer, parseRow, toBooleanColumn, toInstantColumn } from '../columns';

const settingsRowSchema = z
	.object({
		all_day_collapsed: booleanColumn,
		created_at: z.string(),
		default_event_duration: z.number(),
		language: z.string(),
		menu_bar_enabled: booleanColumn,
		microphone_enabled: booleanColumn,
		notifications_enabled: booleanColumn,
		onboarding_completed: booleanColumn,
		show_week_numbers: booleanColumn,
		show_weekends: booleanColumn,
		sound: z.string(),
		sounds_enabled: booleanColumn,
		theme: z.string(),
		time_format: z.string(),
		tour_completed: booleanColumn,
		updated_at: z.string(),
		week_start: z.string(),
	})
	.transform(
		(row): DomainFields<typeof settingsSchema> => ({
			allDayCollapsed: row.all_day_collapsed,
			createdAt: row.created_at,
			defaultEventDuration: row.default_event_duration,
			language: row.language,
			menuBarEnabled: row.menu_bar_enabled,
			microphoneEnabled: row.microphone_enabled,
			notificationsEnabled: row.notifications_enabled,
			onboardingCompleted: row.onboarding_completed,
			showWeekends: row.show_weekends,
			showWeekNumbers: row.show_week_numbers,
			sound: row.sound,
			soundsEnabled: row.sounds_enabled,
			theme: row.theme,
			timeFormat: row.time_format,
			tourCompleted: row.tour_completed,
			updatedAt: row.updated_at,
			weekStart: row.week_start,
		})
	)
	// Re-validate reads with the domain schema so a corrupt row never reaches use cases.
	.pipe(settingsSchema);

export class SqliteSettingsRepository implements SettingsRepository {
	private readonly getStatement: StatementSync;
	private readonly saveStatement: StatementSync;

	constructor(db: DatabaseSync) {
		this.getStatement = db.prepare(
			`SELECT all_day_collapsed, default_event_duration, language, menu_bar_enabled, microphone_enabled, notifications_enabled, onboarding_completed, show_weekends, show_week_numbers,
				sound, sounds_enabled, theme, time_format, tour_completed, week_start, created_at, updated_at
			FROM settings WHERE id = 1`
		);
		this.saveStatement = db.prepare(
			`INSERT INTO settings (id, all_day_collapsed, default_event_duration, language, menu_bar_enabled, microphone_enabled, notifications_enabled, onboarding_completed, show_weekends,
				show_week_numbers, sound, sounds_enabled, theme, time_format, tour_completed, week_start, created_at, updated_at)
			VALUES (1, :all_day_collapsed, :default_event_duration, :language, :menu_bar_enabled, :microphone_enabled, :notifications_enabled, :onboarding_completed, :show_weekends,
				:show_week_numbers, :sound, :sounds_enabled, :theme, :time_format, :tour_completed, :week_start, :created_at, :updated_at)
			ON CONFLICT (id) DO UPDATE SET
				all_day_collapsed = excluded.all_day_collapsed, default_event_duration = excluded.default_event_duration, language = excluded.language,
				menu_bar_enabled = excluded.menu_bar_enabled, microphone_enabled = excluded.microphone_enabled,
				notifications_enabled = excluded.notifications_enabled, onboarding_completed = excluded.onboarding_completed,
				show_weekends = excluded.show_weekends, show_week_numbers = excluded.show_week_numbers,
				sound = excluded.sound, sounds_enabled = excluded.sounds_enabled,
				theme = excluded.theme, time_format = excluded.time_format, tour_completed = excluded.tour_completed, week_start = excluded.week_start,
				created_at = excluded.created_at, updated_at = excluded.updated_at`
		);
	}

	get(): Promise<Settings | null> {
		return defer(() => {
			const row = this.getStatement.get();
			return row === undefined ? null : parseRow(settingsRowSchema, row);
		});
	}

	save(settings: Settings): Promise<void> {
		return defer(() => {
			this.saveStatement.run({
				all_day_collapsed: toBooleanColumn(settings.allDayCollapsed),
				created_at: toInstantColumn(settings.createdAt),
				default_event_duration: settings.defaultEventDuration,
				language: settings.language,
				menu_bar_enabled: toBooleanColumn(settings.menuBarEnabled),
				microphone_enabled: toBooleanColumn(settings.microphoneEnabled),
				notifications_enabled: toBooleanColumn(settings.notificationsEnabled),
				onboarding_completed: toBooleanColumn(settings.onboardingCompleted),
				show_week_numbers: toBooleanColumn(settings.showWeekNumbers),
				show_weekends: toBooleanColumn(settings.showWeekends),
				sound: settings.sound,
				sounds_enabled: toBooleanColumn(settings.soundsEnabled),
				theme: settings.theme,
				time_format: settings.timeFormat,
				tour_completed: toBooleanColumn(settings.tourCompleted),
				updated_at: toInstantColumn(settings.updatedAt),
				week_start: settings.weekStart,
			});
		});
	}
}
