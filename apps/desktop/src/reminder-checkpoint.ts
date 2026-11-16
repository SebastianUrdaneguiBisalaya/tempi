import { readFileSync, writeFileSync } from 'node:fs';
import { utcInstantSchema } from '@tempi/core';
import { z } from 'zod';
import type { ReminderCheckpoint } from './reminder-scheduler';

const checkpointSchema = z.object({ handledUntil: utcInstantSchema });

/**
 * The reminder checkpoint as a small JSON file. It is this device's delivery state, not user data, so it stays out of
 * the database (and out of any future sync). A missing or unreadable file reads as a first run.
 */
export const fileReminderCheckpoint = (file: string): ReminderCheckpoint => ({
	load: () => {
		try {
			const parsed = checkpointSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
			return parsed.success ? parsed.data.handledUntil : null;
		} catch {
			return null;
		}
	},
	save: instant => {
		try {
			writeFileSync(file, JSON.stringify({ handledUntil: instant }));
		} catch (error) {
			console.error('Failed to save the reminder checkpoint', error);
		}
	},
});
