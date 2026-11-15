import type { DatabaseSync } from 'node:sqlite';
import type { CalendarRepository, EventRepository, ProfileRepository, SettingsRepository } from '@tempi/core';
import { SqliteCalendarRepository } from './repositories/sqlite-calendar-repository';
import { SqliteEventRepository } from './repositories/sqlite-event-repository';
import { SqliteProfileRepository } from './repositories/sqlite-profile-repository';
import { SqliteSettingsRepository } from './repositories/sqlite-settings-repository';

export { systemClock, uuidv7, uuidv7Ids } from './ids';
export type { Migration } from './migrations';
export { loadMigrations, migrate, readUserVersion } from './migrations';
export type { OpenDatabaseOptions } from './open-database';
export { backupPath, openDatabase } from './open-database';
export { SqliteCalendarRepository } from './repositories/sqlite-calendar-repository';
export { SqliteEventRepository } from './repositories/sqlite-event-repository';
export { SqliteProfileRepository } from './repositories/sqlite-profile-repository';
export { SqliteSettingsRepository } from './repositories/sqlite-settings-repository';
export { DEFAULT_CALENDAR, seedDefaultCalendar } from './seed';
export { transaction } from './transaction';

export type SqliteRepositories = {
	calendars: CalendarRepository;
	events: EventRepository;
	profile: ProfileRepository;
	settings: SettingsRepository;
};

/** Every SQLite adapter over one open database, ready to merge into core's `CoreDeps`. */
export const createRepositories = (db: DatabaseSync): SqliteRepositories => ({
	calendars: new SqliteCalendarRepository(db),
	events: new SqliteEventRepository(db),
	profile: new SqliteProfileRepository(db),
	settings: new SqliteSettingsRepository(db),
});
