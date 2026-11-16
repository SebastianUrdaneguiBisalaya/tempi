import { beforeEach, describe, expect, test } from 'bun:test';
import type { GoogleSyncStatus } from '@tempi/core';
import { GoogleAuthError, GoogleOfflineError, type SyncSummary } from '@tempi/sync-google';
import { createSyncRunner, EDIT_DEBOUNCE_MS, SYNC_INTERVAL_MS } from './sync-runner';

const SUMMARY: SyncSummary = { pulled: 1, pushed: 0, skipped: 0 };

let timers: { callback: () => void; canceled: boolean; ms: number }[];
let statuses: GoogleSyncStatus[];
let syncs: number;
let outcome: () => Promise<SyncSummary>;

const runner = () =>
	createSyncRunner({
		now: () => new Date('2026-11-16T10:00:00.000Z'),
		onStatus: status => statuses.push(status),
		setTimer: (callback, ms) => {
			const timer = { callback, canceled: false, ms };
			timers.push(timer);
			return () => {
				timer.canceled = true;
			};
		},
		sync: () => {
			syncs += 1;
			return outcome();
		},
	});

/** Fires the live timers set for `ms`. */
const fire = (ms: number) => {
	for (const timer of timers.filter(timer => timer.ms === ms && !timer.canceled)) {
		timer.canceled = true;
		timer.callback();
	}
};

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
	timers = [];
	statuses = [];
	syncs = 0;
	outcome = () => Promise.resolve(SUMMARY);
});

describe('sync runner', () => {
	test('syncs on start and on every interval, reporting each state', async () => {
		const google = runner();
		google.start();
		await settle();
		expect(syncs).toBe(1);
		expect(statuses.map(status => status.state)).toEqual(['syncing', 'idle']);
		expect(google.status()).toEqual({ error: null, lastSyncedAt: '2026-11-16T10:00:00.000Z', state: 'idle' });
		fire(SYNC_INTERVAL_MS);
		await settle();
		expect(syncs).toBe(2);
	});

	test('requests during a sync fold into one more sync', async () => {
		let release: () => void = () => undefined;
		outcome = () => new Promise(resolve => (release = () => resolve(SUMMARY)));
		const google = runner();
		google.start();
		await settle();
		// The first sync is running: both requests wait for one more.
		const a = google.syncNow();
		const b = google.syncNow();
		expect(a).toBe(b);
		release();
		await settle();
		release();
		await Promise.all([a, b]);
		expect(syncs).toBe(2);
	});

	test('a burst of local edits syncs once, after a pause', async () => {
		const google = runner();
		google.start();
		await settle();
		google.schedule();
		google.schedule();
		google.schedule();
		fire(EDIT_DEBOUNCE_MS);
		await settle();
		expect(syncs).toBe(2);
	});

	test('reports offline, a lost grant and other failures, keeping the last success', async () => {
		const google = runner();
		google.start();
		await settle();
		outcome = () => Promise.reject(new GoogleOfflineError('down'));
		expect(await google.syncNow()).toEqual({ error: 'google.offline', lastSyncedAt: '2026-11-16T10:00:00.000Z', state: 'offline' });
		outcome = () => Promise.reject(new GoogleAuthError('revoked'));
		expect(await google.syncNow()).toMatchObject({ error: 'google.reconnectRequired', state: 'reconnect' });
		outcome = () => Promise.reject(new Error('boom'));
		expect(await google.syncNow()).toMatchObject({ error: 'google.syncFailed', state: 'error' });
	});

	test('stopping waits for the sync in progress, then never syncs again', async () => {
		let release: () => void = () => undefined;
		outcome = () => new Promise(resolve => (release = () => resolve(SUMMARY)));
		const google = runner();
		google.start();
		await settle();
		const stopped = google.stop();
		release();
		await stopped;
		expect(google.status()).toEqual({ error: null, lastSyncedAt: null, state: 'idle' });
		await google.syncNow();
		google.schedule();
		fire(SYNC_INTERVAL_MS);
		fire(EDIT_DEBOUNCE_MS);
		await settle();
		expect(syncs).toBe(1);
	});
});
