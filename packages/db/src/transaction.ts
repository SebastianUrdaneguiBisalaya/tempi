import type { DatabaseSync } from 'node:sqlite';

/** Runs `fn` in an immediate write transaction, rolling back if it throws. */
export const transaction = <T>(db: DatabaseSync, fn: () => T): T => {
	db.exec('BEGIN IMMEDIATE');
	try {
		const result = fn();
		db.exec('COMMIT');
		return result;
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	}
};
