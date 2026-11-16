import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { prepareRestore, swapInRestore, writeBackup } from './backup';
import { createRepositories } from './index';
import { loadMigrations } from './migrations';
import { openDatabase } from './open-database';

const T0 = '2026-11-15T10:00:00.000Z';
const clock = { now: () => new Date(T0) };
const AVATAR = { bytes: new Uint8Array([1, 2, 3, 4]), name: '01890a5d-ac96-774b-bcce-b302099a8057.webp' };

let dir: string;
let live: string;
let backup: string;
let staging: string;

beforeEach(() => {
	dir = mkdtempSync(path.join(tmpdir(), 'tempi-backup-'));
	live = path.join(dir, 'tempi.db');
	backup = path.join(dir, 'chosen', 'backup.db');
	staging = path.join(dir, 'tempi.db.restoring');
	mkdirSync(path.dirname(backup));
});

afterEach(() => rmSync(dir, { force: true, recursive: true }));

/** Everything a user sees, read through the repositories. */
const snapshot = async (db: DatabaseSync) => {
	const repos = createRepositories(db);
	const calendars = await repos.calendars.list();
	const events = (await Promise.all(calendars.map(calendar => repos.events.listByCalendar(calendar.id)))).flat();
	return { calendars, events, profile: await repos.profile.get(), settings: await repos.settings.get() };
};

const seed = async (db: DatabaseSync, title: string) => {
	const repos = createRepositories(db);
	const [calendar] = await repos.calendars.list();
	if (calendar === undefined) throw new Error('no calendar');
	await repos.events.save({
		allDay: false,
		calendarId: calendar.id,
		createdAt: T0,
		deletedAt: null,
		description: null,
		endAt: '2026-11-20T15:00:00.000Z',
		exDates: [],
		icalUid: null,
		id: `event-${title}`,
		location: null,
		originalStartAt: null,
		recurringEventId: null,
		reminderMinutes: null,
		rrule: null,
		startAt: '2026-11-20T14:00:00.000Z',
		status: 'confirmed',
		timeZone: 'UTC',
		title,
		updatedAt: T0,
		videoUrl: null,
	});
};

describe('backup and restore', () => {
	test('a restored backup shows exactly the backed-up data, and its files', async () => {
		const db = openDatabase(live, { clock });
		await seed(db, 'Before backup');
		const backedUp = await snapshot(db);
		writeBackup(db, backup, [AVATAR]);
		await seed(db, 'After backup');
		db.close();

		const prepared = await prepareRestore(backup, staging, { clock });
		expect(prepared).toEqual({ ok: true, value: { files: [{ bytes: AVATAR.bytes, name: AVATAR.name }] } });
		swapInRestore(staging, live);

		const restored = openDatabase(live, { clock });
		expect(await snapshot(restored)).toEqual(backedUp);
		// The carried files never end up in the live database.
		expect(restored.prepare("SELECT name FROM sqlite_master WHERE name = 'tempi_backup_files'").get()).toBeUndefined();
		restored.close();
		expect(existsSync(`${live}.before-restore`)).toBe(true);
	});

	test('the backup is a single file that overwrites an older one', async () => {
		const db = openDatabase(live, { clock });
		writeFileSync(backup, 'old');
		writeBackup(db, backup, []);
		db.close();
		expect(readdirSync(path.dirname(backup))).toEqual(['backup.db']);
		expect((await prepareRestore(backup, staging, { clock })).ok).toBe(true);
	});

	test('a backup from an older version is migrated when restored', async () => {
		const migrations = loadMigrations();
		const old = openDatabase(backup, { clock, migrations: migrations.slice(0, 3) });
		old.close();

		expect((await prepareRestore(backup, staging, { clock })).ok).toBe(true);
		const restored = new DatabaseSync(staging);
		expect(restored.prepare('PRAGMA user_version').get()).toEqual({ user_version: migrations.length });
		restored.close();
		expect(readdirSync(dir).filter(name => name.startsWith('tempi.db.restoring'))).toEqual(['tempi.db.restoring']);
	});

	test.each([
		['a text file', () => writeFileSync(backup, 'not a database'), 'backup.invalidFile'],
		[
			'another SQLite database',
			() => {
				const other = new DatabaseSync(backup);
				other.exec('CREATE TABLE notes (body TEXT)');
				other.close();
			},
			'backup.invalidFile',
		],
		[
			'a backup from a newer Tempi',
			() => {
				const newer = openDatabase(backup, { clock });
				newer.exec('PRAGMA user_version = 999');
				newer.close();
			},
			'backup.newerVersion',
		],
	])('rejects %s without touching current data', async (_name, make, key) => {
		const db = openDatabase(live, { clock });
		await seed(db, 'Current');
		const current = await snapshot(db);
		make();

		expect(await prepareRestore(backup, staging, { clock })).toMatchObject({ error: { issues: [{ key }] }, ok: false });
		expect(existsSync(staging)).toBe(false);
		expect(await snapshot(db)).toEqual(current);
		db.close();
	});

	test('rejects a Tempi database with rows that break the domain rules', async () => {
		const bad = openDatabase(backup, { clock });
		bad.exec("UPDATE calendars SET color = 'blue'");
		bad.close();

		expect(await prepareRestore(backup, staging, { clock })).toMatchObject({ error: { issues: [{ key: 'backup.invalidFile' }] }, ok: false });
		expect(existsSync(staging)).toBe(false);
	});

	test('swapping keeps the current database if the staged one is missing', () => {
		writeFileSync(live, 'current');
		expect(() => swapInRestore(staging, live)).toThrow();
		expect(readFileSync(live, 'utf8')).toBe('current');
	});
});
