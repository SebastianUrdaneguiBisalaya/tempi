import { beforeEach, describe, expect, test } from 'bun:test';
import type { RemainingToday } from '@tempi/core';
import { createIconBadge, drawOverlay, OVERLAY_SIZE, overlayLabel, platformBadge } from './icon-badge';

const T0 = Date.parse('2026-11-20T15:00:00.000Z');

let now: number;
let timers: { at: number; callback: () => void }[];
let shown: number[];
let answers: (RemainingToday | Error)[];
let counted: number;

beforeEach(() => {
	now = T0;
	timers = [];
	shown = [];
	answers = [];
	counted = 0;
});

const badge = () =>
	createIconBadge({
		count: () => {
			counted++;
			const answer = answers.shift();
			if (answer === undefined) return Promise.reject(new Error('no answer'));
			return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
		},
		now: () => new Date(now),
		setTimer: (callback, ms) => {
			const timer = { at: now + ms, callback };
			timers.push(timer);
			return () => {
				timers = timers.filter(pending => pending !== timer);
			};
		},
		show: count => void shown.push(count),
	});

/** Runs the pending timer when it comes due, as a running app would. */
const fireTimer = async () => {
	expect(timers).toHaveLength(1);
	const [timer] = timers;
	if (timer === undefined) return;
	timers = [];
	now = timer.at;
	timer.callback();
	await Promise.resolve();
	await Promise.resolve();
};

describe('createIconBadge', () => {
	test('shows the count and waits with one timer for the next change', async () => {
		answers.push({ count: 3, nextChangeAt: '2026-11-20T15:30:00.000Z' }, { count: 2, nextChangeAt: '2026-11-21T05:00:00.000Z' }, { count: 4, nextChangeAt: '2026-11-21T06:00:00.000Z' });
		const icon = badge();
		await icon.setEnabled(true);
		expect(shown).toEqual([3]);
		expect(timers.map(timer => timer.at)).toEqual([Date.parse('2026-11-20T15:30:00.000Z')]);

		await fireTimer();
		expect(shown).toEqual([3, 2]);
		// Local midnight: a new day's count.
		await fireTimer();
		expect(shown).toEqual([3, 2, 4]);
		expect(timers).toHaveLength(1);
	});

	test('a refresh replaces the pending timer instead of adding one', async () => {
		answers.push({ count: 1, nextChangeAt: '2026-11-20T16:00:00.000Z' }, { count: 2, nextChangeAt: '2026-11-20T15:10:00.000Z' });
		const icon = badge();
		await icon.setEnabled(true);
		await icon.refresh();
		expect(shown).toEqual([1, 2]);
		expect(timers.map(timer => timer.at)).toEqual([Date.parse('2026-11-20T15:10:00.000Z')]);
	});

	test('turning it off clears the badge and the timer without counting', async () => {
		answers.push({ count: 3, nextChangeAt: '2026-11-20T16:00:00.000Z' });
		const icon = badge();
		await icon.setEnabled(true);
		await icon.setEnabled(false);
		expect(shown).toEqual([3, 0]);
		expect(timers).toEqual([]);
		await icon.refresh();
		expect(counted).toBe(1);
	});

	test('a count that fails keeps the badge as it is and leaves no timer', async () => {
		answers.push(new Error('disk I/O error'));
		const icon = badge();
		await icon.setEnabled(true);
		expect(shown).toEqual([]);
		expect(timers).toEqual([]);
	});

	test('a slower, older count never overwrites a newer one', async () => {
		const pending: { release?: (value: RemainingToday) => void } = {};
		const icon = createIconBadge({
			count: () => (counted++ === 0 ? new Promise(resolve => (pending.release = resolve)) : Promise.resolve({ count: 5, nextChangeAt: '2026-11-20T16:00:00.000Z' })),
			now: () => new Date(now),
			setTimer: () => () => undefined,
			show: count => void shown.push(count),
		});
		const first = icon.setEnabled(true);
		await icon.refresh();
		pending.release?.({ count: 1, nextChangeAt: '2026-11-20T16:00:00.000Z' });
		await first;
		expect(shown).toEqual([5]);
	});

	test('stops for good', async () => {
		answers.push({ count: 3, nextChangeAt: '2026-11-20T16:00:00.000Z' });
		const icon = badge();
		await icon.setEnabled(true);
		icon.stop();
		expect(timers).toEqual([]);
		await icon.refresh();
		expect(counted).toBe(1);
	});
});

describe('overlayLabel', () => {
	test('is empty for no events and caps at 9+', () => {
		expect([0, 1, 9, 10, 42].map(overlayLabel)).toEqual(['', '1', '9', '9+', '9+']);
	});
});

describe('drawOverlay', () => {
	const pixel = (pixels: Uint8Array, x: number, y: number) => [...pixels.slice((y * OVERLAY_SIZE + x) * 4, (y * OVERLAY_SIZE + x) * 4 + 4)];

	test('draws an opaque red circle with transparent corners', () => {
		const pixels = drawOverlay('');
		expect(pixels).toHaveLength(OVERLAY_SIZE * OVERLAY_SIZE * 4);
		expect(pixel(pixels, 0, 0)).toEqual([0, 0, 0, 0]);
		expect(pixel(pixels, 16, 16)).toEqual([0x4d, 0x48, 0xe5, 255]);
	});

	test('draws the label in white inside the circle', () => {
		// The middle column of `1` runs through the center.
		expect(pixel(drawOverlay('1'), 16, 16)).toEqual([255, 255, 255, 255]);
		expect(drawOverlay('9+')).not.toEqual(drawOverlay('9'));
	});
});

describe('platformBadge', () => {
	const fakes = (platform: NodeJS.Platform, open = true) => {
		const calls: unknown[][] = [];
		const images: string[] = [];
		const window = { isDestroyed: () => false, setOverlayIcon: (overlay: string | null, description: string) => void calls.push(['overlay', overlay, description]) };
		const show = platformBadge<string>({
			app: { dock: { setBadge: text => void calls.push(['dock', text]) }, setBadgeCount: count => (calls.push(['count', count]), true) },
			description: count => `Events left today: ${count}`,
			image: pixels => {
				const image = `image-${images.length + 1}-${pixels.length}`;
				images.push(image);
				return image;
			},
			platform,
			window: () => (open ? window : null),
		});
		return { calls, images, show };
	};

	test('macOS writes the number on the Dock icon and clears it at 0', () => {
		const { calls, show } = fakes('darwin');
		show(12);
		show(0);
		expect(calls).toEqual([
			['dock', '12'],
			['dock', ''],
		]);
	});

	test('Linux sets the launcher count', () => {
		const { calls, show } = fakes('linux');
		show(3);
		show(0);
		expect(calls).toEqual([
			['count', 3],
			['count', 0],
		]);
	});

	test('Windows overlays a drawn badge, cached per label, and removes it at 0', () => {
		const { calls, images, show } = fakes('win32');
		show(2);
		show(12);
		show(15);
		show(2);
		show(0);
		expect(images).toHaveLength(2);
		expect(calls).toEqual([
			['overlay', images[0], 'Events left today: 2'],
			['overlay', images[1], 'Events left today: 12'],
			['overlay', images[1], 'Events left today: 15'],
			['overlay', images[0], 'Events left today: 2'],
			['overlay', null, ''],
		]);
	});

	test('Windows skips the badge while the main window is closed', () => {
		const { calls, show } = fakes('win32', false);
		show(2);
		expect(calls).toEqual([]);
	});
});
