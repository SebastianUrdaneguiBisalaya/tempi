import { existsSync, renameSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fail, ok, type Result } from '@tempi/core';
import { z } from 'zod';
import { loadMigrations, readUserVersion } from './migrations';
import { backupPath, type OpenDatabaseOptions, openDatabase } from './open-database';
import { SqliteCalendarRepository } from './repositories/sqlite-calendar-repository';
import { SqliteEventRepository } from './repositories/sqlite-event-repository';
import { SqliteProfileRepository } from './repositories/sqlite-profile-repository';
import { SqliteSettingsRepository } from './repositories/sqlite-settings-repository';

/** A file kept outside the database that a backup carries along, e.g. the profile photo. */
export type BackupFile = { bytes: Uint8Array; name: string };

/** Only in backup files: what lives outside the database. Restoring takes it out again. */
const FILES_TABLE = 'tempi_backup_files';

const REQUIRED_TABLES = ['calendars', 'events', 'profile', 'settings'] as const;

const fileRowSchema = z.object({ bytes: z.instanceof(Uint8Array), name: z.string() });

/** Where a database keeps its write-ahead log and shared memory while open. */
const sidecars = (path: string) => [`${path}-wal`, `${path}-shm`];

const removeDatabaseFiles = (path: string) => {
	for (const file of [path, ...sidecars(path)]) rmSync(file, { force: true });
};

/**
 * Writes a consistent snapshot of `db` to `target` with `VACUUM INTO`, replacing any file there, and embeds `files`.
 * Must run outside a transaction: SQLite refuses to VACUUM inside one.
 */
export const writeBackup = (db: DatabaseSync, target: string, files: readonly BackupFile[]): void => {
	removeDatabaseFiles(target);
	db.prepare('VACUUM INTO ?').run(target);
	const copy = new DatabaseSync(target);
	try {
		copy.exec(`CREATE TABLE ${FILES_TABLE} (name TEXT PRIMARY KEY NOT NULL, bytes BLOB NOT NULL) STRICT`);
		const insert = copy.prepare(`INSERT INTO ${FILES_TABLE} (name, bytes) VALUES (:name, :bytes)`);
		for (const file of files) insert.run({ bytes: file.bytes, name: file.name });
		// A backup is a single file the user moves around: no WAL beside it.
		copy.exec('PRAGMA journal_mode = DELETE');
	} catch (error) {
		copy.close();
		removeDatabaseFiles(target);
		throw error;
	}
	copy.close();
};

const invalid = (detail: string) => fail('validation', 'backup.invalidFile', { detail });

/** Checks, without writing to it, that `source` is a Tempi database this app can read. */
const checkBackup = (source: string, latest: number): Result<null> => {
	let db: DatabaseSync;
	try {
		db = new DatabaseSync(source, { readOnly: true });
	} catch (error) {
		return invalid(`Cannot open ${source}: ${error instanceof Error ? error.message : String(error)}`);
	}
	try {
		const check = db.prepare('PRAGMA quick_check').get();
		if (check?.quick_check !== 'ok') return invalid(`Integrity check failed: ${JSON.stringify(check)}`);
		const tables = new Set(
			db
				.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
				.all()
				.map(row => String(row.name))
		);
		const missing = REQUIRED_TABLES.filter(table => !tables.has(table));
		if (missing.length > 0) return invalid(`Missing tables: ${missing.join(', ')}`);
		const version = readUserVersion(db);
		if (version < 1) return invalid('Schema version 0');
		if (version > latest) return fail('validation', 'backup.newerVersion', { detail: `Backup schema v${version} is newer than this app supports (v${latest})` });
		return ok(null);
	} catch (error) {
		// Not a database at all ("file is not a database") fails on the first query.
		return invalid(`Cannot read ${source}: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		db.close();
	}
};

/**
 * Prepares a restore without touching the current data: checks that `source` is a Tempi database, copies it to
 * `staging`, takes out the files it carries, brings its schema up to date and reads its rows back through the
 * repositories (which validate them). On any failure `staging` is removed and nothing else changed.
 */
export const prepareRestore = async (source: string, staging: string, options: OpenDatabaseOptions = {}): Promise<Result<{ files: BackupFile[] }>> => {
	const migrations = options.migrations ?? loadMigrations();
	const checked = checkBackup(source, migrations.at(-1)?.version ?? 0);
	if (!checked.ok) return checked;

	removeDatabaseFiles(staging);
	let version = 0;
	try {
		// A consistent copy, read through SQLite rather than the file system, so a backup with a journal copies whole.
		const reader = new DatabaseSync(source, { readOnly: true });
		try {
			reader.prepare('VACUUM INTO ?').run(staging);
		} finally {
			reader.close();
		}

		let files: BackupFile[] = [];
		const extract = new DatabaseSync(staging);
		try {
			version = readUserVersion(extract);
			if (extract.prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?").get(FILES_TABLE) !== undefined) {
				files = extract
					.prepare(`SELECT name, bytes FROM ${FILES_TABLE}`)
					.all()
					.map(row => fileRowSchema.parse(row));
				extract.exec(`DROP TABLE ${FILES_TABLE}`);
			}
		} finally {
			extract.close();
		}

		const db = openDatabase(staging, { ...options, migrations });
		try {
			// Reading parses every row with the domain schemas: a corrupt backup fails here, before anything is replaced.
			await new SqliteProfileRepository(db).get();
			await new SqliteSettingsRepository(db).get();
			const events = new SqliteEventRepository(db);
			for (const calendar of await new SqliteCalendarRepository(db).list()) await events.listByCalendar(calendar.id);
			// Leave a single self-contained file to move into place.
			db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
			db.exec('PRAGMA journal_mode = DELETE');
		} finally {
			db.close();
		}
		return ok({ files });
	} catch (error) {
		removeDatabaseFiles(staging);
		return invalid(`Cannot restore ${source}: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		// Migrating the staged copy may have left a pre-migration copy beside it.
		if (version > 0) rmSync(backupPath(staging, version), { force: true });
	}
};

/**
 * Puts the staged database in place of the one at `path`, keeping the current one as `${path}.before-restore`.
 * Call it with the database closed. If the swap fails halfway, the current database is put back.
 */
export const swapInRestore = (staging: string, path: string): void => {
	const previous = `${path}.before-restore`;
	removeDatabaseFiles(previous);
	const moved: [string, string][] = [];
	try {
		const pairs: [string, string][] = [[path, previous], ...sidecars(path).map((file, index): [string, string] => [file, `${previous}${['-wal', '-shm'][index]}`])];
		for (const [from, to] of pairs) {
			if (!existsSync(from)) continue;
			renameSync(from, to);
			moved.push([from, to]);
		}
		renameSync(staging, path);
	} catch (error) {
		for (const [from, to] of moved.reverse()) renameSync(to, from);
		throw error;
	}
};
