import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileReminderCheckpoint } from './reminder-checkpoint';

let dir: string;
let file: string;

beforeEach(() => {
	dir = mkdtempSync(path.join(tmpdir(), 'tempi-reminders-'));
	file = path.join(dir, 'reminders.json');
});

afterEach(() => rmSync(dir, { force: true, recursive: true }));

describe('fileReminderCheckpoint', () => {
	test('reads a missing file as a first run', () => {
		expect(fileReminderCheckpoint(file).load()).toBeNull();
	});

	test('keeps the saved instant across instances', () => {
		fileReminderCheckpoint(file).save('2026-11-20T13:50:00.001Z');
		expect(fileReminderCheckpoint(file).load()).toBe('2026-11-20T13:50:00.001Z');
	});

	test('reads a corrupt or malformed file as a first run', () => {
		writeFileSync(file, '{not json');
		expect(fileReminderCheckpoint(file).load()).toBeNull();
		writeFileSync(file, JSON.stringify({ handledUntil: 'yesterday' }));
		expect(fileReminderCheckpoint(file).load()).toBeNull();
	});
});
