import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { type CalendarEvent, calendarEventSchema, type DateRange, type EventRepository } from '@tempi/core';
import { z } from 'zod';
import { booleanColumn, type DomainFields, defer, parseRow, toBooleanColumn, toInstantColumn } from '../columns';

const eventRowSchema = z
	.object({
		all_day: booleanColumn,
		calendar_id: z.string(),
		created_at: z.string(),
		deleted_at: z.string().nullable(),
		description: z.string().nullable(),
		end_at: z.string(),
		ical_uid: z.string().nullable(),
		// JSON text; the domain schema below checks what it holds.
		ex_dates: z.string().transform((text, ctx): unknown => {
			try {
				return JSON.parse(text);
			} catch {
				ctx.addIssue({ code: 'custom', message: 'ex_dates is not JSON' });
				return z.NEVER;
			}
		}),
		id: z.string(),
		location: z.string().nullable(),
		original_start_at: z.string().nullable(),
		recurring_event_id: z.string().nullable(),
		reminder_minutes: z.number().nullable(),
		rrule: z.string().nullable(),
		start_at: z.string(),
		status: z.string(),
		time_zone: z.string(),
		title: z.string(),
		updated_at: z.string(),
		video_url: z.string().nullable(),
	})
	.transform(
		(row): DomainFields<typeof calendarEventSchema> => ({
			allDay: row.all_day,
			calendarId: row.calendar_id,
			createdAt: row.created_at,
			deletedAt: row.deleted_at,
			description: row.description,
			endAt: row.end_at,
			exDates: row.ex_dates,
			icalUid: row.ical_uid,
			id: row.id,
			location: row.location,
			originalStartAt: row.original_start_at,
			recurringEventId: row.recurring_event_id,
			reminderMinutes: row.reminder_minutes,
			rrule: row.rrule,
			startAt: row.start_at,
			status: row.status,
			timeZone: row.time_zone,
			title: row.title,
			updatedAt: row.updated_at,
			videoUrl: row.video_url,
		})
	)
	// Re-validate reads with the domain schema so a corrupt row never reaches use cases.
	.pipe(calendarEventSchema);

const toRow = (event: CalendarEvent) => ({
	all_day: toBooleanColumn(event.allDay),
	calendar_id: event.calendarId,
	created_at: toInstantColumn(event.createdAt),
	deleted_at: event.deletedAt === null ? null : toInstantColumn(event.deletedAt),
	description: event.description,
	end_at: toInstantColumn(event.endAt),
	ex_dates: JSON.stringify(event.exDates.map(toInstantColumn)),
	ical_uid: event.icalUid,
	id: event.id,
	location: event.location,
	original_start_at: event.originalStartAt === null ? null : toInstantColumn(event.originalStartAt),
	recurring_event_id: event.recurringEventId,
	reminder_minutes: event.reminderMinutes,
	rrule: event.rrule,
	start_at: toInstantColumn(event.startAt),
	status: event.status,
	time_zone: event.timeZone,
	title: event.title,
	updated_at: toInstantColumn(event.updatedAt),
	video_url: event.videoUrl,
});

/**
 * FTS5 query for `text`: each word becomes a quoted prefix term (`"reu"*`), and every term must match. Quoting keeps
 * FTS syntax typed by the user (`AND`, `-`, `:`, `"`) literal. Null when there is no word to look for.
 */
export const toSearchQuery = (text: string): string | null => {
	const terms = text
		.split(/\s+/)
		.filter(word => word !== '')
		.map(word => `"${word.replaceAll('"', '""')}"*`);
	return terms.length === 0 ? null : terms.join(' ');
};

const COLUMNS =
	'id, calendar_id, title, description, location, video_url, start_at, end_at, all_day, time_zone, rrule, ex_dates, recurring_event_id, original_start_at, reminder_minutes, status, ical_uid, created_at, updated_at, deleted_at';

export class SqliteEventRepository implements EventRepository {
	private readonly findByIdStatement: StatementSync;
	private readonly findByUidStatement: StatementSync;
	private readonly listByCalendarStatement: StatementSync;
	private readonly listBySeriesStatement: StatementSync;
	private readonly listInRangeStatement: StatementSync;
	private readonly listSeriesStatement: StatementSync;
	private readonly saveStatement: StatementSync;
	private readonly searchStatement: StatementSync;
	private readonly moveToCalendarStatement: StatementSync;
	private readonly softDeleteByCalendarStatement: StatementSync;

	constructor(db: DatabaseSync) {
		this.findByIdStatement = db.prepare(`SELECT ${COLUMNS} FROM events WHERE id = :id`);
		this.findByUidStatement = db.prepare(
			`SELECT ${COLUMNS} FROM events WHERE calendar_id = :calendar_id AND deleted_at IS NULL AND recurring_event_id IS NULL AND (ical_uid = :uid OR (ical_uid IS NULL AND id = :uid)) ORDER BY created_at, id LIMIT 1`
		);
		this.listByCalendarStatement = db.prepare(`SELECT ${COLUMNS} FROM events WHERE calendar_id = :calendar_id AND deleted_at IS NULL ORDER BY start_at, id`);
		// Half-open overlap: [start_at, end_at) intersects [start, end). Text comparison works because instants are normalized UTC.
		// Series are expanded by core, so only events without a recurrence are listed by their own times.
		this.listInRangeStatement = db.prepare(`SELECT ${COLUMNS} FROM events WHERE deleted_at IS NULL AND rrule IS NULL AND start_at < :end AND end_at > :start ORDER BY start_at, id`);
		this.listSeriesStatement = db.prepare(`SELECT ${COLUMNS} FROM events WHERE deleted_at IS NULL AND rrule IS NOT NULL AND start_at < :before ORDER BY start_at, id`);
		this.listBySeriesStatement = db.prepare(`SELECT ${COLUMNS} FROM events WHERE deleted_at IS NULL AND recurring_event_id = :series_id ORDER BY original_start_at, id`);
		this.searchStatement = db.prepare(
			`SELECT ${COLUMNS} FROM events WHERE rowid IN (SELECT rowid FROM events_search WHERE events_search MATCH :query) AND deleted_at IS NULL ORDER BY start_at DESC, id LIMIT :limit`
		);
		this.saveStatement = db.prepare(
			`INSERT INTO events (${COLUMNS})
			VALUES (:id, :calendar_id, :title, :description, :location, :video_url, :start_at, :end_at, :all_day, :time_zone, :rrule, :ex_dates, :recurring_event_id, :original_start_at, :reminder_minutes, :status, :ical_uid, :created_at, :updated_at, :deleted_at)
			ON CONFLICT (id) DO UPDATE SET
				calendar_id = excluded.calendar_id, title = excluded.title, description = excluded.description,
				location = excluded.location, video_url = excluded.video_url, start_at = excluded.start_at, end_at = excluded.end_at,
				all_day = excluded.all_day, time_zone = excluded.time_zone, rrule = excluded.rrule, ex_dates = excluded.ex_dates,
				recurring_event_id = excluded.recurring_event_id, original_start_at = excluded.original_start_at,
				reminder_minutes = excluded.reminder_minutes, status = excluded.status, ical_uid = excluded.ical_uid,
				created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`
		);
		this.moveToCalendarStatement = db.prepare('UPDATE events SET calendar_id = :to, updated_at = :updated_at WHERE calendar_id = :from AND deleted_at IS NULL');
		this.softDeleteByCalendarStatement = db.prepare('UPDATE events SET deleted_at = :deleted_at, updated_at = :deleted_at WHERE calendar_id = :calendar_id AND deleted_at IS NULL');
	}

	findById(id: string): Promise<CalendarEvent | null> {
		return defer(() => {
			const row = this.findByIdStatement.get({ id });
			return row === undefined ? null : parseRow(eventRowSchema, row);
		});
	}

	findByUid(calendarId: string, uid: string): Promise<CalendarEvent | null> {
		return defer(() => {
			const row = this.findByUidStatement.get({ calendar_id: calendarId, uid });
			return row === undefined ? null : parseRow(eventRowSchema, row);
		});
	}

	listByCalendar(calendarId: string): Promise<CalendarEvent[]> {
		return defer(() => this.listByCalendarStatement.all({ calendar_id: calendarId }).map(row => parseRow(eventRowSchema, row)));
	}

	listInRange(range: DateRange): Promise<CalendarEvent[]> {
		return defer(() => this.listInRangeStatement.all({ end: toInstantColumn(range.end), start: toInstantColumn(range.start) }).map(row => parseRow(eventRowSchema, row)));
	}

	listBySeries(seriesId: string): Promise<CalendarEvent[]> {
		return defer(() => this.listBySeriesStatement.all({ series_id: seriesId }).map(row => parseRow(eventRowSchema, row)));
	}

	listSeries(before: string): Promise<CalendarEvent[]> {
		return defer(() => this.listSeriesStatement.all({ before: toInstantColumn(before) }).map(row => parseRow(eventRowSchema, row)));
	}

	search(text: string, limit: number): Promise<CalendarEvent[]> {
		return defer(() => {
			const query = toSearchQuery(text);
			return query === null ? [] : this.searchStatement.all({ limit, query }).map(row => parseRow(eventRowSchema, row));
		});
	}

	save(event: CalendarEvent): Promise<void> {
		return defer(() => {
			this.saveStatement.run(toRow(event));
		});
	}

	moveToCalendar(fromCalendarId: string, toCalendarId: string, updatedAt: string): Promise<void> {
		return defer(() => {
			this.moveToCalendarStatement.run({ from: fromCalendarId, to: toCalendarId, updated_at: toInstantColumn(updatedAt) });
		});
	}

	softDeleteByCalendar(calendarId: string, deletedAt: string): Promise<void> {
		return defer(() => {
			this.softDeleteByCalendarStatement.run({ calendar_id: calendarId, deleted_at: toInstantColumn(deletedAt) });
		});
	}
}
