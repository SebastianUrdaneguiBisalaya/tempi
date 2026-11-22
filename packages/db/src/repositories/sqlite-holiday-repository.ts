import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { type FetchedHolidayYear, fetchedHolidayYearSchema, type HolidayRepository, type TrackedHoliday, trackedHolidaySchema } from '@tempi/core';
import { z } from 'zod';
import { type DomainFields, defer, parseRow, toInstantColumn } from '../columns';

const holidayRowSchema = z
	.object({ country: z.string(), created_at: z.string(), date: z.string(), event_id: z.string() })
	.transform((row): DomainFields<typeof trackedHolidaySchema> => ({ country: row.country, createdAt: row.created_at, date: row.date, eventId: row.event_id }))
	.pipe(trackedHolidaySchema);

const yearRowSchema = z
	.object({ country: z.string(), fetched_at: z.string(), year: z.number() })
	.transform((row): DomainFields<typeof fetchedHolidayYearSchema> => ({ country: row.country, fetchedAt: row.fetched_at, year: row.year }))
	.pipe(fetchedHolidayYearSchema);

export class SqliteHolidayRepository implements HolidayRepository {
	private readonly listHolidaysStatement: StatementSync;
	private readonly listYearsStatement: StatementSync;
	private readonly saveHolidayStatement: StatementSync;
	private readonly saveYearStatement: StatementSync;
	private readonly clearHolidaysStatement: StatementSync;
	private readonly clearYearsStatement: StatementSync;

	constructor(db: DatabaseSync) {
		this.listHolidaysStatement = db.prepare('SELECT country, date, event_id, created_at FROM holidays ORDER BY country, date');
		this.listYearsStatement = db.prepare('SELECT country, year, fetched_at FROM holiday_years ORDER BY country, year');
		this.saveHolidayStatement = db.prepare(
			`INSERT INTO holidays (country, date, event_id, created_at) VALUES (:country, :date, :event_id, :created_at)
			ON CONFLICT (country, date) DO UPDATE SET event_id = excluded.event_id, created_at = excluded.created_at`
		);
		this.saveYearStatement = db.prepare(
			`INSERT INTO holiday_years (country, year, fetched_at) VALUES (:country, :year, :fetched_at)
			ON CONFLICT (country, year) DO UPDATE SET fetched_at = excluded.fetched_at`
		);
		// Bookkeeping only: the events stay, soft-deleted by the use case, so their deletion still syncs.
		this.clearHolidaysStatement = db.prepare('DELETE FROM holidays');
		this.clearYearsStatement = db.prepare('DELETE FROM holiday_years');
	}

	listHolidays(): Promise<TrackedHoliday[]> {
		return defer(() => this.listHolidaysStatement.all().map(row => parseRow(holidayRowSchema, row)));
	}

	listFetchedYears(): Promise<FetchedHolidayYear[]> {
		return defer(() => this.listYearsStatement.all().map(row => parseRow(yearRowSchema, row)));
	}

	saveHoliday(holiday: TrackedHoliday): Promise<void> {
		return defer(() => {
			this.saveHolidayStatement.run({ country: holiday.country, created_at: toInstantColumn(holiday.createdAt), date: holiday.date, event_id: holiday.eventId });
		});
	}

	saveFetchedYear(year: FetchedHolidayYear): Promise<void> {
		return defer(() => {
			this.saveYearStatement.run({ country: year.country, fetched_at: toInstantColumn(year.fetchedAt), year: year.year });
		});
	}

	clear(): Promise<void> {
		return defer(() => {
			this.clearHolidaysStatement.run();
			this.clearYearsStatement.run();
		});
	}
}
