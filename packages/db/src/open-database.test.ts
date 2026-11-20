import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadMigrations, migrate, readUserVersion } from './migrations';
import { backupPath, openDatabase } from './open-database';

const fixedClock = { now: () => new Date('2026-11-15T10:00:00.000Z') };

const tempDirs: string[] = [];
const tempDbPath = (): string => {
	const dir = mkdtempSync(join(tmpdir(), 'tempi-db-'));
	tempDirs.push(dir);
	return join(dir, 'tempi.db');
};

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { force: true, recursive: true });
});

const pragma = (db: DatabaseSync, name: string): unknown => Object.values(db.prepare(`PRAGMA ${name}`).get() ?? {})[0];

describe('loadMigrations', () => {
	test('loads the bundled SQL files in order, starting at version 1', () => {
		const migrations = loadMigrations();
		expect(migrations.map(migration => migration.version)).toEqual(migrations.map((_, index) => index + 1));
		expect(migrations[0]?.sql).toContain('CREATE TABLE events');
	});
});

describe('openDatabase', () => {
	test('applies every migration to a new database', () => {
		const db = openDatabase(':memory:', { clock: fixedClock });
		expect(readUserVersion(db)).toBe(loadMigrations().length);
		// FTS5 keeps its index in shadow tables (`events_search_data`, …) next to the virtual table.
		const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'events_search_%' ORDER BY name").all();
		expect(tables.map(table => table.name)).toEqual(['calendars', 'events', 'events_search', 'google_calendars', 'google_events', 'profile', 'settings']);
		db.close();
	});

	test('sets the required pragmas', () => {
		const path = tempDbPath();
		const db = openDatabase(path, { clock: fixedClock });
		expect(pragma(db, 'journal_mode')).toBe('wal');
		expect(pragma(db, 'foreign_keys')).toBe(1);
		expect(pragma(db, 'synchronous')).toBe(1); // NORMAL
		expect(pragma(db, 'busy_timeout')).toBe(5000);
		db.close();
	});

	test('seeds one default calendar on first run only', () => {
		const path = tempDbPath();
		openDatabase(path, { clock: fixedClock }).close();
		const db = openDatabase(path, { clock: fixedClock });
		const calendars = db.prepare('SELECT is_default, source, created_at FROM calendars').all();
		expect(calendars).toEqual([expect.objectContaining({ created_at: '2026-11-15T10:00:00.000Z', is_default: 1, source: 'local' })]);
		db.close();
	});

	test('backs up an existing database with VACUUM INTO before migrating', () => {
		const path = tempDbPath();
		const v1 = loadMigrations();
		openDatabase(path, { clock: fixedClock, migrations: v1 }).close();

		const v2 = [...v1, { sql: 'ALTER TABLE calendars ADD COLUMN extra TEXT;', version: v1.length + 1 }];
		openDatabase(path, { clock: fixedClock, migrations: v2 }).close();

		const backup = new DatabaseSync(backupPath(path, v1.length), { readOnly: true });
		expect(readUserVersion(backup)).toBe(v1.length);
		expect(backup.prepare('SELECT COUNT(*) AS count FROM calendars').get()).toEqual(expect.objectContaining({ count: 1 }));
		backup.close();
	});

	test('does not back up a new database or one already up to date', () => {
		const path = tempDbPath();
		openDatabase(path, { clock: fixedClock }).close();
		openDatabase(path, { clock: fixedClock }).close();
		expect(existsSync(backupPath(path, 0))).toBe(false);
		expect(existsSync(backupPath(path, loadMigrations().length))).toBe(false);
	});

	test('refuses a database created by a newer app version', () => {
		const path = tempDbPath();
		const db = new DatabaseSync(path);
		db.exec('PRAGMA user_version = 999');
		db.close();
		expect(() => openDatabase(path, { clock: fixedClock })).toThrow('newer than this app supports');
	});
});

describe('migrate', () => {
	test('0002 keeps existing settings and starts the all-day lane expanded', () => {
		const db = new DatabaseSync(':memory:');
		const [init, ...rest] = loadMigrations();
		if (init === undefined) throw new Error('missing 0001 migration');
		migrate(db, [init]);
		db.exec(`INSERT INTO settings (id, default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends,
			show_week_numbers, theme, time_format, week_start, created_at, updated_at)
			VALUES (1, 30, 'es', 0, 1, 1, 1, 'dark', '24h', 'monday', '2026-11-15T10:00:00.000Z', '2026-11-15T10:00:00.000Z')`);
		migrate(db, [init, ...rest]);
		expect(db.prepare('SELECT all_day_collapsed, language, show_week_numbers FROM settings').get()).toEqual({
			all_day_collapsed: 0,
			language: 'es',
			show_week_numbers: 1,
		});
		db.close();
	});

	test('0007 keeps existing settings and turns notifications and the microphone on', () => {
		const db = new DatabaseSync(':memory:');
		const migrations = loadMigrations();
		migrate(db, migrations.slice(0, 6));
		db.exec(`INSERT INTO settings (id, default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends,
			show_week_numbers, theme, time_format, week_start, created_at, updated_at)
			VALUES (1, 30, 'es', 0, 1, 1, 1, 'dark', '24h', 'monday', '2026-11-15T10:00:00.000Z', '2026-11-15T10:00:00.000Z')`);
		migrate(db, migrations);
		expect(db.prepare('SELECT language, microphone_enabled, notifications_enabled FROM settings').get()).toEqual({
			language: 'es',
			microphone_enabled: 1,
			notifications_enabled: 1,
		});
		expect(() => db.exec('UPDATE settings SET notifications_enabled = 2')).toThrow();
		db.close();
	});

	test('0008 keeps existing settings and leaves the tour pending, so existing users see it once', () => {
		const db = new DatabaseSync(':memory:');
		const migrations = loadMigrations();
		migrate(db, migrations.slice(0, 7));
		db.exec(`INSERT INTO settings (id, default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends,
			show_week_numbers, theme, time_format, week_start, created_at, updated_at)
			VALUES (1, 30, 'es', 0, 1, 1, 1, 'dark', '24h', 'monday', '2026-11-15T10:00:00.000Z', '2026-11-15T10:00:00.000Z')`);
		migrate(db, migrations);
		expect(db.prepare('SELECT language, onboarding_completed, tour_completed FROM settings').get()).toEqual({
			language: 'es',
			onboarding_completed: 1,
			tour_completed: 0,
		});
		expect(() => db.exec('UPDATE settings SET tour_completed = 2')).toThrow();
		db.close();
	});

	test('0009 keeps existing settings and turns UI sounds on with the tick preset', () => {
		const db = new DatabaseSync(':memory:');
		const migrations = loadMigrations();
		migrate(db, migrations.slice(0, 8));
		db.exec(`INSERT INTO settings (id, default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends,
			show_week_numbers, theme, time_format, week_start, created_at, updated_at)
			VALUES (1, 30, 'es', 0, 1, 1, 1, 'dark', '24h', 'monday', '2026-11-15T10:00:00.000Z', '2026-11-15T10:00:00.000Z')`);
		migrate(db, migrations);
		expect(db.prepare('SELECT language, sound, sounds_enabled FROM settings').get()).toEqual({ language: 'es', sound: 'tick', sounds_enabled: 1 });
		expect(() => db.exec('UPDATE settings SET sounds_enabled = 2')).toThrow();
		db.close();
	});

	test('0010 keeps existing settings and leaves opening at login off', () => {
		const db = new DatabaseSync(':memory:');
		const migrations = loadMigrations();
		migrate(db, migrations.slice(0, 9));
		db.exec(`INSERT INTO settings (id, default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends,
			show_week_numbers, theme, time_format, week_start, created_at, updated_at)
			VALUES (1, 30, 'es', 1, 1, 1, 1, 'dark', '24h', 'monday', '2026-11-15T10:00:00.000Z', '2026-11-15T10:00:00.000Z')`);
		migrate(db, migrations);
		expect(db.prepare('SELECT language, menu_bar_enabled, open_at_login_enabled FROM settings').get()).toEqual({ language: 'es', menu_bar_enabled: 1, open_at_login_enabled: 0 });
		expect(() => db.exec('UPDATE settings SET open_at_login_enabled = 2')).toThrow();
		db.close();
	});

	test('0011 keeps existing settings and turns the icon badge on', () => {
		const db = new DatabaseSync(':memory:');
		const migrations = loadMigrations();
		migrate(db, migrations.slice(0, 10));
		db.exec(`INSERT INTO settings (id, default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends,
			show_week_numbers, theme, time_format, week_start, created_at, updated_at)
			VALUES (1, 30, 'es', 0, 1, 1, 1, 'dark', '24h', 'monday', '2026-11-15T10:00:00.000Z', '2026-11-15T10:00:00.000Z')`);
		migrate(db, migrations);
		expect(db.prepare('SELECT language, icon_badge_enabled FROM settings').get()).toEqual({ language: 'es', icon_badge_enabled: 1 });
		expect(() => db.exec('UPDATE settings SET icon_badge_enabled = 2')).toThrow();
		db.close();
	});

	test('0012 keeps existing settings with no secondary time zones and stores only JSON arrays', () => {
		const db = new DatabaseSync(':memory:');
		const migrations = loadMigrations();
		migrate(db, migrations.slice(0, 11));
		db.exec(`INSERT INTO settings (id, default_event_duration, language, menu_bar_enabled, onboarding_completed, show_weekends,
			show_week_numbers, theme, time_format, week_start, created_at, updated_at)
			VALUES (1, 30, 'es', 0, 1, 1, 1, 'dark', '24h', 'monday', '2026-11-15T10:00:00.000Z', '2026-11-15T10:00:00.000Z')`);
		migrate(db, migrations);
		expect(db.prepare('SELECT language, secondary_time_zones FROM settings').get()).toEqual({ language: 'es', secondary_time_zones: '[]' });
		expect(() => db.exec(`UPDATE settings SET secondary_time_zones = 'Asia/Kolkata'`)).toThrow();
		expect(() => db.exec(`UPDATE settings SET secondary_time_zones = '{}'`)).toThrow();
		db.close();
	});

	test('rolls back a failing migration and leaves the version unchanged', () => {
		const db = new DatabaseSync(':memory:');
		const migrations = [
			{ sql: 'CREATE TABLE a (id TEXT);', version: 1 },
			{ sql: 'CREATE TABLE b (id TEXT); INSERT INTO missing VALUES (1);', version: 2 },
		];
		expect(() => migrate(db, migrations)).toThrow();
		expect(readUserVersion(db)).toBe(1);
		expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'b'").get()).toBeUndefined();
		db.close();
	});
});
