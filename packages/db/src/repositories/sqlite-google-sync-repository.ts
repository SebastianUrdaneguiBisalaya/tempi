import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { type CalendarEvent, type GoogleCalendarLink, type GoogleEventLink, type GoogleSyncRepository, googleCalendarLinkSchema, googleEventLinkSchema } from '@tempi/core';
import { z } from 'zod';
import { booleanColumn, type DomainFields, defer, parseRow, toBooleanColumn, toInstantColumn } from '../columns';
import { EVENT_COLUMNS, eventRowSchema } from './sqlite-event-repository';

const calendarLinkRowSchema = z
	.object({
		access_role: z.string(),
		calendar_id: z.string().nullable(),
		color: z.string(),
		google_id: z.string(),
		is_primary: booleanColumn,
		name: z.string(),
		selected: booleanColumn,
		sync_token: z.string().nullable(),
		time_zone: z.string(),
	})
	.transform(
		(row): DomainFields<typeof googleCalendarLinkSchema> => ({
			accessRole: row.access_role,
			calendarId: row.calendar_id,
			color: row.color,
			googleId: row.google_id,
			name: row.name,
			primary: row.is_primary,
			selected: row.selected,
			syncToken: row.sync_token,
			timeZone: row.time_zone,
		})
	)
	.pipe(googleCalendarLinkSchema);

const eventLinkRowSchema = z
	.object({ etag: z.string(), event_id: z.string(), google_calendar_id: z.string(), google_event_id: z.string(), meet: booleanColumn, synced_updated_at: z.string() })
	.transform(
		(row): DomainFields<typeof googleEventLinkSchema> => ({
			etag: row.etag,
			eventId: row.event_id,
			googleCalendarId: row.google_calendar_id,
			googleEventId: row.google_event_id,
			meet: row.meet,
			syncedUpdatedAt: row.synced_updated_at,
		})
	)
	.pipe(googleEventLinkSchema);

const CALENDAR_COLUMNS = 'google_id, calendar_id, name, color, access_role, is_primary, time_zone, selected, sync_token';
const EVENT_LINK_COLUMNS = 'event_id, google_calendar_id, google_event_id, etag, meet, synced_updated_at';
const PENDING_COLUMNS = EVENT_COLUMNS.split(', ')
	.map(column => `e.${column}`)
	.join(', ');

export class SqliteGoogleSyncRepository implements GoogleSyncRepository {
	private readonly listCalendarsStatement: StatementSync;
	private readonly saveCalendarStatement: StatementSync;
	private readonly deleteCalendarStatement: StatementSync;
	private readonly deleteEventLinksStatement: StatementSync;
	private readonly findEventLinkStatement: StatementSync;
	private readonly findEventLinkByGoogleIdStatement: StatementSync;
	private readonly listEventLinksStatement: StatementSync;
	private readonly saveEventLinkStatement: StatementSync;
	private readonly deleteEventLinkStatement: StatementSync;
	private readonly listPendingStatement: StatementSync;
	private readonly clearCalendarsStatement: StatementSync;
	private readonly clearEventsStatement: StatementSync;

	constructor(db: DatabaseSync) {
		this.listCalendarsStatement = db.prepare(`SELECT ${CALENDAR_COLUMNS} FROM google_calendars ORDER BY google_id`);
		this.saveCalendarStatement = db.prepare(
			`INSERT INTO google_calendars (${CALENDAR_COLUMNS})
			VALUES (:google_id, :calendar_id, :name, :color, :access_role, :is_primary, :time_zone, :selected, :sync_token)
			ON CONFLICT (google_id) DO UPDATE SET
				calendar_id = excluded.calendar_id, name = excluded.name, color = excluded.color, access_role = excluded.access_role,
				is_primary = excluded.is_primary, time_zone = excluded.time_zone, selected = excluded.selected, sync_token = excluded.sync_token`
		);
		this.deleteCalendarStatement = db.prepare('DELETE FROM google_calendars WHERE google_id = :google_id');
		this.deleteEventLinksStatement = db.prepare('DELETE FROM google_events WHERE google_calendar_id = :google_calendar_id');
		this.findEventLinkStatement = db.prepare(`SELECT ${EVENT_LINK_COLUMNS} FROM google_events WHERE event_id = :event_id`);
		this.findEventLinkByGoogleIdStatement = db.prepare(`SELECT ${EVENT_LINK_COLUMNS} FROM google_events WHERE google_calendar_id = :google_calendar_id AND google_event_id = :google_event_id`);
		this.listEventLinksStatement = db.prepare(`SELECT ${EVENT_LINK_COLUMNS} FROM google_events WHERE google_calendar_id = :google_calendar_id`);
		this.saveEventLinkStatement = db.prepare(
			`INSERT INTO google_events (${EVENT_LINK_COLUMNS})
			VALUES (:event_id, :google_calendar_id, :google_event_id, :etag, :meet, :synced_updated_at)
			ON CONFLICT (event_id) DO UPDATE SET
				google_calendar_id = excluded.google_calendar_id, google_event_id = excluded.google_event_id,
				etag = excluded.etag, meet = excluded.meet, synced_updated_at = excluded.synced_updated_at`
		);
		this.deleteEventLinkStatement = db.prepare('DELETE FROM google_events WHERE event_id = :event_id');
		// Calendar ids arrive as one JSON array, so the statement stays prepared whatever their number.
		this.listPendingStatement = db.prepare(
			`SELECT ${PENDING_COLUMNS} FROM events e LEFT JOIN google_events g ON g.event_id = e.id
			WHERE (g.event_id IS NOT NULL AND e.updated_at > g.synced_updated_at)
				OR (g.event_id IS NULL AND e.deleted_at IS NULL AND e.calendar_id IN (SELECT value FROM json_each(:calendar_ids)))
			ORDER BY e.recurring_event_id IS NOT NULL, e.updated_at, e.id`
		);
		this.clearCalendarsStatement = db.prepare('DELETE FROM google_calendars');
		this.clearEventsStatement = db.prepare('DELETE FROM google_events');
	}

	listCalendars(): Promise<GoogleCalendarLink[]> {
		return defer(() => this.listCalendarsStatement.all().map(row => parseRow(calendarLinkRowSchema, row)));
	}

	saveCalendar(link: GoogleCalendarLink): Promise<void> {
		return defer(() => {
			this.saveCalendarStatement.run({
				access_role: link.accessRole,
				calendar_id: link.calendarId,
				color: link.color,
				google_id: link.googleId,
				is_primary: toBooleanColumn(link.primary),
				name: link.name,
				selected: toBooleanColumn(link.selected),
				sync_token: link.syncToken,
				time_zone: link.timeZone,
			});
		});
	}

	deleteCalendar(googleId: string): Promise<void> {
		return defer(() => {
			this.deleteEventLinksStatement.run({ google_calendar_id: googleId });
			this.deleteCalendarStatement.run({ google_id: googleId });
		});
	}

	deleteEventLinks(googleCalendarId: string): Promise<void> {
		return defer(() => {
			this.deleteEventLinksStatement.run({ google_calendar_id: googleCalendarId });
		});
	}

	findEventLink(eventId: string): Promise<GoogleEventLink | null> {
		return defer(() => {
			const row = this.findEventLinkStatement.get({ event_id: eventId });
			return row === undefined ? null : parseRow(eventLinkRowSchema, row);
		});
	}

	findEventLinkByGoogleId(googleCalendarId: string, googleEventId: string): Promise<GoogleEventLink | null> {
		return defer(() => {
			const row = this.findEventLinkByGoogleIdStatement.get({ google_calendar_id: googleCalendarId, google_event_id: googleEventId });
			return row === undefined ? null : parseRow(eventLinkRowSchema, row);
		});
	}

	listEventLinks(googleCalendarId: string): Promise<GoogleEventLink[]> {
		return defer(() => this.listEventLinksStatement.all({ google_calendar_id: googleCalendarId }).map(row => parseRow(eventLinkRowSchema, row)));
	}

	saveEventLink(link: GoogleEventLink): Promise<void> {
		return defer(() => {
			this.saveEventLinkStatement.run({
				etag: link.etag,
				event_id: link.eventId,
				google_calendar_id: link.googleCalendarId,
				google_event_id: link.googleEventId,
				meet: toBooleanColumn(link.meet),
				synced_updated_at: toInstantColumn(link.syncedUpdatedAt),
			});
		});
	}

	deleteEventLink(eventId: string): Promise<void> {
		return defer(() => {
			this.deleteEventLinkStatement.run({ event_id: eventId });
		});
	}

	listPendingEvents(calendarIds: string[]): Promise<CalendarEvent[]> {
		return defer(() => this.listPendingStatement.all({ calendar_ids: JSON.stringify(calendarIds) }).map(row => parseRow(eventRowSchema, row)));
	}

	clear(): Promise<void> {
		return defer(() => {
			this.clearEventsStatement.run();
			this.clearCalendarsStatement.run();
		});
	}
}
