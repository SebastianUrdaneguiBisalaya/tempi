import { readdirSync, readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { transaction } from './transaction';

export type Migration = { sql: string; version: number };

const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url);

/** `0001_init.sql` → version 1. */
const migrationFileSchema = z
	.string()
	.regex(/^\d{4}_[a-z0-9_]+\.sql$/)
	.transform(name => Number.parseInt(name.slice(0, 4), 10));

/** Reads the bundled SQL migrations, ordered and checked to be consecutive from 1. */
export const loadMigrations = (dir: URL = MIGRATIONS_DIR): Migration[] => {
	const migrations = readdirSync(dir)
		.filter(name => name.endsWith('.sql'))
		.map(name => ({ sql: readFileSync(new URL(name, dir), 'utf8'), version: migrationFileSchema.parse(name) }))
		.sort((a, b) => a.version - b.version);
	migrations.forEach((migration, index) => {
		if (migration.version !== index + 1) throw new Error(`Migrations must be consecutive from 1; found version ${migration.version} at position ${index + 1}`);
	});
	return migrations;
};

const userVersionSchema = z.object({ user_version: z.number().int().min(0) });

export const readUserVersion = (db: DatabaseSync): number => userVersionSchema.parse(db.prepare('PRAGMA user_version').get()).user_version;

/** Applies every migration newer than `PRAGMA user_version`, each in its own transaction. Forward-only. */
export const migrate = (db: DatabaseSync, migrations: Migration[]): void => {
	const current = readUserVersion(db);
	const latest = migrations.at(-1)?.version ?? 0;
	if (current > latest) throw new Error(`Database schema v${current} is newer than this app supports (v${latest})`);

	for (const migration of migrations) {
		if (migration.version <= current) continue;
		transaction(db, () => {
			db.exec(migration.sql);
			// PRAGMA takes no bound parameters; the version is an integer parsed from a bundled file name.
			db.exec(`PRAGMA user_version = ${migration.version}`);
		});
	}
};
