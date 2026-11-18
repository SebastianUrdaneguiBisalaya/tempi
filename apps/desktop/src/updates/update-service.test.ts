import { describe, expect, test } from 'bun:test';
import type { AppUpdateStatus } from '@tempi/core';
import { fetchLatestRelease, type LatestRelease, type ReleaseFetch } from './latest-release';
import { CHECK_INTERVAL_MS, createUpdateService, type DownloaderEvent, FIRST_CHECK_DELAY_MS, type UpdateStrategy } from './update-service';

const NOW = new Date('2026-11-16T12:00:00Z');

const setup = (strategy: UpdateStrategy, currentVersion = '0.1.0') => {
	const statuses: AppUpdateStatus[] = [];
	const timers: { callback: () => void; ms: number }[] = [];
	const service = createUpdateService({
		currentVersion,
		now: () => NOW,
		onStatus: status => statuses.push(status),
		setTimer: (callback, ms) => {
			timers.push({ callback, ms });
			return () => undefined;
		},
		strategy,
	});
	return { service, statuses, timers };
};

const notify = (latest: LatestRelease | null | Error): UpdateStrategy => ({
	kind: 'notify',
	latestRelease: () => (latest instanceof Error ? Promise.reject(latest) : Promise.resolve(latest)),
});

/** A fake electron-updater: `check` reports the queued events, as the real one does before resolving. */
const fakeDownloader = (events: DownloaderEvent[]) => {
	let listener: (event: DownloaderEvent) => void = () => undefined;
	let installs = 0;
	const strategy: UpdateStrategy = {
		downloader: {
			check: () => {
				for (const event of events) listener(event);
				return Promise.resolve();
			},
			install: () => {
				installs++;
			},
			subscribe: next => {
				listener = next;
			},
		},
		kind: 'download',
	};
	return { emit: (event: DownloaderEvent) => listener(event), installs: () => installs, strategy };
};

describe('update service, notify (macOS)', () => {
	const release = { url: 'https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/tag/v0.2.0', version: '0.2.0' };

	test('offers a newer release with its page', async () => {
		const { service } = setup(notify(release));
		expect(await service.check()).toMatchObject({ downloadUrl: release.url, latestVersion: '0.2.0', state: 'available' });
	});

	test('stays quiet when the latest release is the installed one or older', async () => {
		expect((await setup(notify(release), '0.2.0').service.check()).state).toBe('upToDate');
		expect((await setup(notify(release), '0.3.0').service.check()).state).toBe('upToDate');
	});

	test('is up to date while nothing has been published yet', async () => {
		expect((await setup(notify(null)).service.check()).state).toBe('upToDate');
	});

	test('reports a failed check without throwing', async () => {
		const { service } = setup(notify(new Error('offline')));
		expect(await service.check()).toMatchObject({ checkedAt: NOW.toISOString(), state: 'error' });
	});

	test('reports checking, then the outcome', async () => {
		const { service, statuses } = setup(notify(release));
		await service.check();
		expect(statuses.map(status => status.state)).toEqual(['checking', 'available']);
	});

	test('joins a check in progress instead of starting another', async () => {
		let calls = 0;
		const { service } = setup({
			kind: 'notify',
			latestRelease: () => {
				calls++;
				return Promise.resolve(release);
			},
		});
		await Promise.all([service.check(), service.check()]);
		expect(calls).toBe(1);
	});

	test('cannot install anything', async () => {
		const { service } = setup(notify(release));
		await service.check();
		expect(service.install()).toBe(false);
	});
});

describe('update service, download (Windows, Linux AppImage)', () => {
	test('downloads a newer version, then is ready to install', async () => {
		const downloader = fakeDownloader([{ type: 'available', version: '0.2.0' }]);
		const { service } = setup(downloader.strategy);
		expect(await service.check()).toMatchObject({ latestVersion: '0.2.0', state: 'downloading' });
		downloader.emit({ type: 'downloaded', version: '0.2.0' });
		expect(service.status().state).toBe('ready');
		expect(service.install()).toBe(true);
		expect(downloader.installs()).toBe(1);
	});

	test('is up to date when the updater finds nothing', async () => {
		const { service } = setup(fakeDownloader([{ type: 'notAvailable' }]).strategy);
		expect((await service.check()).state).toBe('upToDate');
	});

	test('keeps a downloaded update ready through later checks and errors', async () => {
		const downloader = fakeDownloader([]);
		const { service } = setup(downloader.strategy);
		downloader.emit({ type: 'downloaded', version: '0.2.0' });
		downloader.emit({ error: new Error('network'), type: 'error' });
		expect((await service.check()).state).toBe('ready');
	});

	test('does not install before the download finishes', async () => {
		const downloader = fakeDownloader([{ type: 'available', version: '0.2.0' }]);
		const { service } = setup(downloader.strategy);
		await service.check();
		expect(service.install()).toBe(false);
		expect(downloader.installs()).toBe(0);
	});
});

describe('update service, development build', () => {
	test('never checks or schedules', async () => {
		const { service, statuses, timers } = setup({ kind: 'unsupported' });
		service.start();
		expect((await service.check()).state).toBe('unsupported');
		expect(statuses).toEqual([]);
		expect(timers).toEqual([]);
	});
});

describe('update schedule', () => {
	test('checks shortly after start, then on the interval', async () => {
		const { service, timers } = setup(notify(null));
		service.start();
		expect(timers.map(timer => timer.ms)).toEqual([FIRST_CHECK_DELAY_MS]);
		timers[0]?.callback();
		await Bun.sleep(0);
		expect(timers.map(timer => timer.ms)).toEqual([FIRST_CHECK_DELAY_MS, CHECK_INTERVAL_MS]);
	});
});

describe('fetchLatestRelease', () => {
	const answer =
		(status: number, body: unknown): ReleaseFetch =>
		async () => ({ json: async () => body, ok: status >= 200 && status < 300, status });

	test('a GitHub that never answers fails the check at the deadline instead of leaving it checking', async () => {
		const hanging: ReleaseFetch = (_url, init) =>
			new Promise((_resolve, reject) => {
				init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
			});
		await expect(fetchLatestRelease(hanging, 'o/r', 10)).rejects.toThrow();
	});

	test('reads the version without the tag prefix and the release page', async () => {
		const release = await fetchLatestRelease(answer(200, { html_url: 'https://github.com/o/r/releases/tag/v1.2.0', tag_name: 'v1.2.0' }), 'o/r');
		expect(release).toEqual({ url: 'https://github.com/o/r/releases/tag/v1.2.0', version: '1.2.0' });
	});

	test('is null when the repository has no published release', async () => {
		expect(await fetchLatestRelease(answer(404, { message: 'Not Found' }), 'o/r')).toBeNull();
	});

	test('rejects other failures and malformed answers', async () => {
		await expect(fetchLatestRelease(answer(403, {}), 'o/r')).rejects.toThrow('403');
		await expect(fetchLatestRelease(answer(200, { html_url: 'javascript:alert(1)', tag_name: 'v1.0.0' }), 'o/r')).rejects.toThrow();
	});
});
