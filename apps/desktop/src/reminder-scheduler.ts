import type { DateRange, Reminder, Result } from '@tempi/core';

/** Where the scheduler remembers up to when reminders were already delivered, across restarts. */
export type ReminderCheckpoint = {
	/** The instant (UTC ISO-8601) every reminder before it was handled, or null on the first run. */
	load(): string | null;
	save(instant: string): void;
};

export type ReminderSchedulerDeps = {
	checkpoint: ReminderCheckpoint;
	/** Reminders firing in the range, read fresh from storage on every check. */
	listReminders: (range: DateRange) => Promise<Result<Reminder[]>>;
	notify: (reminder: Reminder) => void;
	now: () => Date;
	/** Runs `callback` after `ms`; returns the function that cancels it. */
	setTimer: (callback: () => void, ms: number) => () => void;
};

export type ReminderScheduler = {
	/** Checks now and plans the next check. Call it after anything that may change reminders: data, a wake from sleep. */
	reschedule: () => Promise<void>;
	stop: () => void;
};

/**
 * Longest wait between checks. Timers drift or pause while the computer sleeps, so the scheduler never trusts one
 * for long: it re-reads storage at least this often.
 */
export const MAX_WAIT_MS = 60 * 60_000;

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Delivers reminders at their time. Each check reads the reminders from storage, so an edited or deleted event never
 * fires a stale one; it delivers those due since the checkpoint (late ones too, e.g. after sleep or a restart, as long
 * as their event hasn't ended), moves the checkpoint past them so none fires twice, and sleeps until the next one.
 */
export const createReminderScheduler = (deps: ReminderSchedulerDeps): ReminderScheduler => {
	let cancelTimer: (() => void) | null = null;
	let stopped = false;
	// Checks run one at a time, so overlapping reschedules never deliver the same reminder twice.
	let queue = Promise.resolve();

	const plan = (ms: number) => {
		cancelTimer = deps.setTimer(() => void reschedule(), Math.min(Math.max(ms, 0), MAX_WAIT_MS));
	};

	const check = async () => {
		cancelTimer?.();
		cancelTimer = null;
		if (stopped) return;

		const now = deps.now().getTime();
		// Ranges are end-exclusive: a check handles everything before `handled`, `now` included.
		const handled = now + 1;
		const saved = Date.parse(deps.checkpoint.load() ?? '');
		// The first run starts now: reminders from before Tempi ever ran aren't owed. A clock set back can't move it past now.
		const from = Number.isNaN(saved) ? now : Math.min(saved, handled);
		const listed = await deps.listReminders({ end: iso(now + MAX_WAIT_MS), start: iso(from) });
		if (stopped) return;
		if (!listed.ok) {
			console.error('Failed to list reminders', listed.error);
			plan(MAX_WAIT_MS);
			return;
		}

		for (const reminder of listed.value) {
			if (Date.parse(reminder.fireAt) > now) break;
			if (Date.parse(reminder.occurrence.endAt) > now) deps.notify(reminder);
		}
		deps.checkpoint.save(iso(handled));
		const next = listed.value.find(reminder => Date.parse(reminder.fireAt) > now);
		plan(next === undefined ? MAX_WAIT_MS : Date.parse(next.fireAt) - now);
	};

	const reschedule = () => {
		queue = queue.then(check).catch((error: unknown) => {
			console.error('Reminder check failed', error);
			if (!stopped) plan(MAX_WAIT_MS);
		});
		return queue;
	};

	return {
		reschedule,
		stop: () => {
			stopped = true;
			cancelTimer?.();
			cancelTimer = null;
		},
	};
};
