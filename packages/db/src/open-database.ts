import { rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { type Clock, type IdGenerator, systemClock, uuidv7Ids } from '@tempi/core';
import { loadMigrations, type Migration, migrate, readUserVersion } from './migrations';
import { seedDefaultCalendar } from './seed';

export type OpenDatabaseOptions = {
	clock?: Clock;
	ids?: IdGenerator;
	migrations?: Migration[];
};

const IN_MEMORY = ':memory:';

/** Backup path for a database at `version`, kept next to it. */
export const backupPath = (path: string, version: number): string => `${path}.v${version}.bak`;

const applyPragmas = (db: DatabaseSync): void => {
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA foreign_keys = ON');
	db.exec('PRAGMA synchronous = NORMAL');
	db.exec('PRAGMA busy_timeout = 5000');
};

/** Copies an existing database before migrating it, so a bad migration never loses data. */
const backupBeforeMigrating = (db: DatabaseSync, path: string, migrations: Migration[]): void => {
	const current = readUserVersion(db);
	const hasPending = migrations.some(migration => migration.version > current);
	if (path === IN_MEMORY || current === 0 || !hasPending) return;

	const target = backupPath(path, current);
	// VACUUM INTO refuses to overwrite; a leftover backup of the same version holds the same data.
	rmSync(target, { force: true });
	db.prepare('VACUUM INTO ?').run(target);
};

/** Opens the database, applies pragmas and pending migrations, and seeds the default calendar. */
export const openDatabase = (path: string, options: OpenDatabaseOptions = {}): DatabaseSync => {
	const migrations = options.migrations ?? loadMigrations();
	const db = new DatabaseSync(path);
	try {
		applyPragmas(db);
		backupBeforeMigrating(db, path, migrations);
		migrate(db, migrations);
		seedDefaultCalendar(db, { clock: options.clock ?? systemClock, ids: options.ids ?? uuidv7Ids });
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
};
