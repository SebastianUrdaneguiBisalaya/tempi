import type { DatabaseSync } from 'node:sqlite';
import type { Result } from '@tempi/core';

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

/** Runs async work as one transaction, after every unit queued before it. */
export type TransactionQueue = <T>(work: () => Promise<Result<T>>) => Promise<Result<T>>;

/**
 * Serializes async units of work (core use cases) and wraps each in one transaction.
 * Use cases await between repository calls, so two of them would otherwise interleave their reads and writes
 * and SQLite would refuse the nested BEGIN. A failed Result rolls back like a thrown error: no partial writes either way.
 */
export const createTransactionQueue = (db: DatabaseSync): TransactionQueue => {
	let tail: Promise<unknown> = Promise.resolve();

	return <T>(work: () => Promise<Result<T>>): Promise<Result<T>> => {
		const run = async (): Promise<Result<T>> => {
			db.exec('BEGIN IMMEDIATE');
			try {
				const result = await work();
				db.exec(result.ok ? 'COMMIT' : 'ROLLBACK');
				return result;
			} catch (error) {
				db.exec('ROLLBACK');
				throw error;
			}
		};
		const next = tail.then(run);
		// The queue keeps going after a failure; the caller still sees the rejection through `next`.
		tail = next.catch(() => undefined);
		return next;
	};
};
