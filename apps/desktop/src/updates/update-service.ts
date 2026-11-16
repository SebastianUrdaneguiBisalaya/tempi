import { type AppUpdateStatus, isNewerVersion } from '@tempi/core';
import type { LatestRelease } from './latest-release';

/** The first check waits until startup work settles; later ones run on this interval. */
export const FIRST_CHECK_DELAY_MS = 10 * 1000;
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** What the background updater (electron-updater) reports while it checks and downloads. */
export type DownloaderEvent = { type: 'available'; version: string } | { type: 'notAvailable' } | { type: 'downloaded'; version: string } | { type: 'error'; error: unknown };

/** An updater that downloads in the background and installs on quit (Windows, Linux AppImage). */
export type Downloader = {
	/** Checks for a newer release; when there is one, the download starts and reports through `subscribe`. */
	check: () => Promise<void>;
	/** Quits, installs the downloaded update and reopens the app. */
	install: () => void;
	subscribe: (listener: (event: DownloaderEvent) => void) => void;
};

/**
 * How this build updates: by downloading in the background, by pointing at the newest release to download by hand
 * (macOS without a Developer ID, Linux packages), or not at all (development runs).
 */
export type UpdateStrategy = { downloader: Downloader; kind: 'download' } | { kind: 'notify'; latestRelease: () => Promise<LatestRelease | null> } | { kind: 'unsupported' };

export type UpdateServiceOptions = {
	currentVersion: string;
	now: () => Date;
	/** Every status change. */
	onStatus: (status: AppUpdateStatus) => void;
	/** Calls `callback` after `ms`; returns a function that cancels it. */
	setTimer: (callback: () => void, ms: number) => () => void;
	strategy: UpdateStrategy;
};

export type UpdateService = {
	/** Checks now, or joins the check in progress, and resolves with the outcome. */
	check: () => Promise<AppUpdateStatus>;
	/** Installs a downloaded update; false when none is ready. */
	install: () => boolean;
	/** Checks shortly after launch, then on an interval. */
	start: () => void;
	status: () => AppUpdateStatus;
	stop: () => void;
};

/** Checks for updates one at a time and keeps where they stand; a found update stays found until it's installed. */
export const createUpdateService = (options: UpdateServiceOptions): UpdateService => {
	const { strategy } = options;
	let status: AppUpdateStatus = {
		checkedAt: null,
		currentVersion: options.currentVersion,
		downloadUrl: null,
		latestVersion: null,
		state: strategy.kind === 'unsupported' ? 'unsupported' : 'idle',
	};
	let inFlight: Promise<AppUpdateStatus> | null = null;
	let cancelTimer: (() => void) | null = null;

	const set = (next: Partial<AppUpdateStatus>) => {
		status = { ...status, ...next };
		options.onStatus(status);
	};
	const checked = () => options.now().toISOString();

	const failed = (error: unknown) => {
		console.error('Update check failed', error);
		set({ checkedAt: checked(), state: 'error' });
	};

	if (strategy.kind === 'download') {
		strategy.downloader.subscribe(event => {
			// A downloaded update waits for the restart; later reports can't take it back.
			if (status.state === 'ready') return;
			if (event.type === 'available') set({ latestVersion: event.version, state: 'downloading' });
			else if (event.type === 'notAvailable') set({ checkedAt: checked(), state: 'upToDate' });
			else if (event.type === 'downloaded') set({ checkedAt: checked(), latestVersion: event.version, state: 'ready' });
			else failed(event.error);
		});
	}

	const run = async (): Promise<AppUpdateStatus> => {
		if (strategy.kind === 'unsupported' || status.state === 'ready' || status.state === 'downloading') return status;
		set({ state: 'checking' });
		try {
			if (strategy.kind === 'notify') {
				const latest = await strategy.latestRelease();
				if (latest !== null && isNewerVersion(latest.version, options.currentVersion))
					set({ checkedAt: checked(), downloadUrl: latest.url, latestVersion: latest.version, state: 'available' });
				else set({ checkedAt: checked(), downloadUrl: null, latestVersion: null, state: 'upToDate' });
			} else {
				await strategy.downloader.check();
				// The updater reports through events; a check that ends without one found nothing.
				if (status.state === 'checking') set({ checkedAt: checked(), state: 'upToDate' });
			}
		} catch (error) {
			failed(error);
		}
		return status;
	};

	const check = (): Promise<AppUpdateStatus> => {
		inFlight ??= run().finally(() => {
			inFlight = null;
		});
		return inFlight;
	};

	const scheduleNext = (ms: number) => {
		cancelTimer?.();
		cancelTimer = options.setTimer(() => {
			void check().finally(() => scheduleNext(CHECK_INTERVAL_MS));
		}, ms);
	};

	return {
		check,
		install: () => {
			if (strategy.kind !== 'download' || status.state !== 'ready') return false;
			strategy.downloader.install();
			return true;
		},
		start: () => {
			if (strategy.kind !== 'unsupported') scheduleNext(FIRST_CHECK_DELAY_MS);
		},
		status: () => status,
		stop: () => {
			cancelTimer?.();
			cancelTimer = null;
		},
	};
};
