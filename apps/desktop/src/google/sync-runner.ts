import type { GoogleSyncStatus } from '@tempi/core';
import { GoogleAuthError, GoogleOfflineError } from '@tempi/google-calendar';
import type { SyncSummary } from '@tempi/sync-google';

export const SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** Local edits wait this long, so a burst of them (a drag, several quick edits) syncs once. */
export const EDIT_DEBOUNCE_MS = 10 * 1000;

export type SyncRunnerOptions = {
	sync: () => Promise<SyncSummary>;
	now: () => Date;
	/** Calls `callback` after `ms`; returns a function that cancels it. */
	setTimer: (callback: () => void, ms: number) => () => void;
	/** Every status change; `summary` comes with the end of a successful sync. */
	onStatus: (status: GoogleSyncStatus, summary: SyncSummary | null) => void;
};

export type SyncRunner = {
	status: () => GoogleSyncStatus;
	/** Starts syncing: once now, then every few minutes. */
	start: () => void;
	/** Syncs now, or right after the sync in progress, and resolves with the outcome. Does nothing while stopped. */
	syncNow: () => Promise<GoogleSyncStatus>;
	/** Syncs shortly, folding a burst of requests (local edits) into one sync. */
	schedule: () => void;
	/** Stops syncing and waits for a sync in progress to end, so nothing writes after it. */
	stop: () => Promise<void>;
};

const INITIAL: GoogleSyncStatus = { error: null, lastSyncedAt: null, state: 'idle' };

/** Turns a failed sync into a status: offline and a lost grant are expected; anything else is logged. */
export const failedStatus = (error: unknown, lastSyncedAt: string | null): GoogleSyncStatus => {
	if (error instanceof GoogleOfflineError) return { error: 'google.offline', lastSyncedAt, state: 'offline' };
	if (error instanceof GoogleAuthError) return { error: 'google.reconnectRequired', lastSyncedAt, state: 'reconnect' };
	console.error('Google Calendar sync failed', error);
	return { error: 'google.syncFailed', lastSyncedAt, state: 'error' };
};

/** Runs Google sync one at a time: on start, on an interval, on request and shortly after local edits. */
export const createSyncRunner = (options: SyncRunnerOptions): SyncRunner => {
	let status = INITIAL;
	let active = false;
	let tail: Promise<GoogleSyncStatus> = Promise.resolve(status);
	// A sync waiting for the current one to end; later requests join it instead of queueing more.
	let waiting: Promise<GoogleSyncStatus> | null = null;
	let cancelInterval: (() => void) | null = null;
	let cancelDebounce: (() => void) | null = null;

	const set = (next: GoogleSyncStatus, summary: SyncSummary | null = null) => {
		status = next;
		options.onStatus(status, summary);
	};

	const run = async (): Promise<GoogleSyncStatus> => {
		if (!active) return status;
		set({ ...status, state: 'syncing' });
		try {
			const summary = await options.sync();
			set({ error: null, lastSyncedAt: options.now().toISOString(), state: 'idle' }, summary);
		} catch (error) {
			set(failedStatus(error, status.lastSyncedAt));
		}
		return status;
	};

	const syncNow = (): Promise<GoogleSyncStatus> => {
		if (!active) return Promise.resolve(status);
		if (waiting !== null) return waiting;
		const next = tail.then(() => {
			waiting = null;
			return run();
		});
		waiting = next;
		tail = next;
		return next;
	};

	const tick = () => {
		cancelInterval = options.setTimer(() => {
			void syncNow();
			tick();
		}, SYNC_INTERVAL_MS);
	};

	return {
		schedule: () => {
			if (!active) return;
			cancelDebounce?.();
			cancelDebounce = options.setTimer(() => {
				cancelDebounce = null;
				void syncNow();
			}, EDIT_DEBOUNCE_MS);
		},
		start: () => {
			if (active) return;
			active = true;
			tick();
			void syncNow();
		},
		status: () => status,
		stop: async () => {
			active = false;
			cancelInterval?.();
			cancelDebounce?.();
			cancelInterval = null;
			cancelDebounce = null;
			await tail;
			set(INITIAL);
		},
		syncNow,
	};
};
