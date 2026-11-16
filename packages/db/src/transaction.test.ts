import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { fail, ok } from '@tempi/core';
import { createTransactionQueue, type TransactionQueue } from './transaction';

let db: DatabaseSync;
let queue: TransactionQueue;

beforeEach(() => {
	db = new DatabaseSync(':memory:');
	db.exec('CREATE TABLE log (entry TEXT NOT NULL)');
	queue = createTransactionQueue(db);
});

afterEach(() => db.close());

const insert = (entry: string) => db.prepare('INSERT INTO log (entry) VALUES (?)').run(entry);
const entries = () =>
	db
		.prepare('SELECT entry FROM log ORDER BY rowid')
		.all()
		.map(row => row.entry);
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('createTransactionQueue', () => {
	test('commits the writes of a successful result', async () => {
		expect(await queue(() => Promise.resolve(ok(insert('a') && null)))).toEqual({ ok: true, value: null });
		expect(entries()).toEqual(['a']);
	});

	test('rolls back every write when the result fails after the first write', async () => {
		const result = await queue(async () => {
			insert('a');
			await tick();
			insert('b');
			return fail('conflict', 'calendar.defaultRequired');
		});
		expect(result.ok).toBe(false);
		expect(entries()).toEqual([]);
	});

	test('rolls back and rejects when the work throws, then keeps serving', async () => {
		const failing = queue(async () => {
			insert('a');
			await tick();
			throw new Error('disk full');
		});
		await expect(failing).rejects.toThrow('disk full');
		await queue(() => Promise.resolve(ok(insert('b') && null)));
		expect(entries()).toEqual(['b']);
	});

	test('runs concurrent units one after another, never interleaved', async () => {
		const unit = (name: string) => async () => {
			insert(`${name}:start`);
			await tick();
			insert(`${name}:end`);
			return ok(null);
		};
		await Promise.all([queue(unit('a')), queue(unit('b'))]);
		expect(entries()).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
	});
});
