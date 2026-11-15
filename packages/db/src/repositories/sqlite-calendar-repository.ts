import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { type Calendar, type CalendarRepository, calendarFieldsSchema } from '@tempi/core';
import { z } from 'zod';
import { booleanColumn, type DomainFields, defer, parseRow, storedEntitySchema, toBooleanColumn, toInstantColumn } from '../columns';

// Re-validate reads with the domain schema so a corrupt row never reaches use cases.
const storedCalendarSchema = calendarFieldsSchema.and(storedEntitySchema);

const calendarRowSchema = z
	.object({
		color: z.string(),
		created_at: z.string(),
		deleted_at: z.string().nullable(),
		id: z.string(),
		is_default: booleanColumn,
		is_visible: booleanColumn,
		name: z.string(),
		source: z.string(),
		updated_at: z.string(),
	})
	.transform(
		(row): DomainFields<typeof storedCalendarSchema> => ({
			color: row.color,
			createdAt: row.created_at,
			deletedAt: row.deleted_at,
			id: row.id,
			isDefault: row.is_default,
			isVisible: row.is_visible,
			name: row.name,
			source: row.source,
			updatedAt: row.updated_at,
		})
	)
	.pipe(storedCalendarSchema);

const toRow = (calendar: Calendar) => ({
	color: calendar.color,
	created_at: toInstantColumn(calendar.createdAt),
	deleted_at: calendar.deletedAt === null ? null : toInstantColumn(calendar.deletedAt),
	id: calendar.id,
	is_default: toBooleanColumn(calendar.isDefault),
	is_visible: toBooleanColumn(calendar.isVisible),
	name: calendar.name,
	source: calendar.source,
	updated_at: toInstantColumn(calendar.updatedAt),
});

const COLUMNS = 'id, name, color, source, is_default, is_visible, created_at, updated_at, deleted_at';

export class SqliteCalendarRepository implements CalendarRepository {
	private readonly findByIdStatement: StatementSync;
	private readonly listStatement: StatementSync;
	private readonly saveStatement: StatementSync;

	constructor(db: DatabaseSync) {
		this.findByIdStatement = db.prepare(`SELECT ${COLUMNS} FROM calendars WHERE id = :id`);
		this.listStatement = db.prepare(`SELECT ${COLUMNS} FROM calendars WHERE deleted_at IS NULL ORDER BY is_default DESC, name`);
		this.saveStatement = db.prepare(
			`INSERT INTO calendars (${COLUMNS})
			VALUES (:id, :name, :color, :source, :is_default, :is_visible, :created_at, :updated_at, :deleted_at)
			ON CONFLICT (id) DO UPDATE SET
				name = excluded.name, color = excluded.color, source = excluded.source,
				is_default = excluded.is_default, is_visible = excluded.is_visible,
				created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`
		);
	}

	findById(id: string): Promise<Calendar | null> {
		return defer(() => {
			const row = this.findByIdStatement.get({ id });
			return row === undefined ? null : parseRow(calendarRowSchema, row);
		});
	}

	list(): Promise<Calendar[]> {
		return defer(() => this.listStatement.all().map(row => parseRow(calendarRowSchema, row)));
	}

	save(calendar: Calendar): Promise<void> {
		return defer(() => {
			this.saveStatement.run(toRow(calendar));
		});
	}
}
