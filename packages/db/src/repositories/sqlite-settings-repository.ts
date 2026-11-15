import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { type Settings, type SettingsRepository, settingsValuesSchema } from '@tempi/core';
import { z } from 'zod';
import { booleanColumn, type DomainFields, defer, instantColumn, parseRow, toBooleanColumn, toInstantColumn } from '../columns';

// Re-validate reads with the domain schema so a corrupt row never reaches use cases.
const storedSettingsSchema = settingsValuesSchema.extend({ createdAt: instantColumn, updatedAt: instantColumn });

const settingsRowSchema = z
	.object({
		created_at: z.string(),
		default_event_duration: z.number(),
		language: z.string(),
		menu_bar_enabled: booleanColumn,
		onboarding_completed: booleanColumn,
		show_week_numbers: booleanColumn,
		show_weekends: booleanColumn,
		theme: z.string(),
		time_format: z.string(),
		updated_at: z.string(),
		week_start: z.string(),
	})
	.transform(
		(row): DomainFields<typeof storedSettingsSchema> => ({
			createdAt: row.created_at,
			defaultEventDuration: row.default_event_duration,
			language: row.language,
			menuBarEnabled: row.menu_bar_enabled,
			onboardingCompleted: row.onboarding_completed,
			showWeekends: row.show_weekends,
			showWeekNumbers: row.show_week_numbers,
			theme: row.theme,
			timeFormat: row.time_format,
			updatedAt: row.updated_at,
			weekStart: row.week_start,
		})
	)
	.pipe(storedSettingsSchema);

export class SqliteSettingsRepository implements SettingsRepository {
	private readonly getStatement: StatementSync;
	private readonly saveStatement: StatementSync;

	constructor(db: DatabaseSync) {
		this.getStatement = db.prepare(
			`SELECT default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends, show_week_numbers,
				theme, time_format, week_start, created_at, updated_at
			FROM settings WHERE id = 1`
		);
		this.saveStatement = db.prepare(
			`INSERT INTO settings (id, default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends,
				show_week_numbers, theme, time_format, week_start, created_at, updated_at)
			VALUES (1, :default_event_duration, :language, :menu_bar_enabled, :onboarding_completed, :show_weekends,
				:show_week_numbers, :theme, :time_format, :week_start, :created_at, :updated_at)
			ON CONFLICT (id) DO UPDATE SET
				default_event_duration = excluded.default_event_duration, language = excluded.language,
				menu_bar_enabled = excluded.menu_bar_enabled, onboarding_completed = excluded.onboarding_completed,
				show_weekends = excluded.show_weekends, show_week_numbers = excluded.show_week_numbers,
				theme = excluded.theme, time_format = excluded.time_format, week_start = excluded.week_start,
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
				created_at: toInstantColumn(settings.createdAt),
				default_event_duration: settings.defaultEventDuration,
				language: settings.language,
				menu_bar_enabled: toBooleanColumn(settings.menuBarEnabled),
				onboarding_completed: toBooleanColumn(settings.onboardingCompleted),
				show_week_numbers: toBooleanColumn(settings.showWeekNumbers),
				show_weekends: toBooleanColumn(settings.showWeekends),
				theme: settings.theme,
				time_format: settings.timeFormat,
				updated_at: toInstantColumn(settings.updatedAt),
				week_start: settings.weekStart,
			});
		});
	}
}
