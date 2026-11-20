import type { RemainingToday } from '@tempi/core';

type IconBadgeDeps = {
	/** Today's remaining events and when that changes on its own; throws when it can't be read. */
	count: () => Promise<RemainingToday>;
	now: () => Date;
	setTimer: (callback: () => void, ms: number) => () => void;
	/** Shows the count on the app icon; 0 clears it. */
	show: (count: number) => void;
};

export type IconBadge = {
	/** Counts again, e.g. after events change, the computer wakes up or the time zone changes. */
	refresh: () => Promise<void>;
	/** Follows the setting: on counts and shows the badge, off clears it. */
	setEnabled: (enabled: boolean) => Promise<void>;
	stop: () => void;
};

/**
 * Today's remaining events on the app icon. One timer at most waits for the next instant the count changes (an event
 * ending, or local midnight); nothing runs in between.
 */
export const createIconBadge = (deps: IconBadgeDeps): IconBadge => {
	let enabled = false;
	let stopped = false;
	let cancelTimer: (() => void) | null = null;
	// Only the latest count is shown: an older one finishing late would put back a stale number.
	let generation = 0;

	const clearTimer = () => {
		cancelTimer?.();
		cancelTimer = null;
	};

	const refresh = async () => {
		clearTimer();
		const current = ++generation;
		if (!enabled || stopped) return deps.show(0);
		let result: RemainingToday;
		try {
			result = await deps.count();
		} catch (error) {
			console.error('Failed to count the events left today', error);
			return;
		}
		if (current !== generation || !enabled || stopped) return;
		deps.show(result.count);
		cancelTimer = deps.setTimer(() => void refresh(), Math.max(Date.parse(result.nextChangeAt) - deps.now().getTime(), 0));
	};

	return {
		refresh,
		setEnabled: next => {
			enabled = next;
			return refresh();
		},
		stop: () => {
			stopped = true;
			generation++;
			clearTimer();
		},
	};
};

/** The badge text: nothing for no events, and `9+` once the number no longer fits the small Windows overlay. */
export const overlayLabel = (count: number): string => (count <= 0 ? '' : count > 9 ? '9+' : String(count));

export const OVERLAY_SIZE = 32;

// A 3×5 pixel font, one string per row, for the only characters a badge shows.
const GLYPHS: Record<string, readonly string[]> = {
	'+': ['000', '010', '111', '010', '000'],
	'0': ['111', '101', '101', '101', '111'],
	'1': ['010', '110', '010', '010', '111'],
	'2': ['111', '001', '111', '100', '111'],
	'3': ['111', '001', '111', '001', '111'],
	'4': ['101', '101', '111', '001', '001'],
	'5': ['111', '100', '111', '001', '111'],
	'6': ['111', '100', '111', '101', '111'],
	'7': ['111', '001', '001', '001', '001'],
	'8': ['111', '101', '111', '101', '111'],
	'9': ['111', '101', '111', '001', '111'],
};

const BADGE_RED = { b: 0x4d, g: 0x48, r: 0xe5 };

/**
 * A red circle with the label in white, as a premultiplied BGRA bitmap of `OVERLAY_SIZE` pixels a side (what
 * `nativeImage.createFromBuffer` takes). Drawn in memory, so no image files ship for every number.
 */
export const drawOverlay = (label: string): Uint8Array => {
	const size = OVERLAY_SIZE;
	const pixels = new Uint8Array(size * size * 4);
	const radius = size / 2;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			// Antialiased edge: how much of the pixel lies inside the circle.
			const alpha = Math.min(Math.max(radius - Math.hypot(x + 0.5 - radius, y + 0.5 - radius) + 0.5, 0), 1);
			const i = (y * size + x) * 4;
			pixels[i] = Math.round(BADGE_RED.b * alpha);
			pixels[i + 1] = Math.round(BADGE_RED.g * alpha);
			pixels[i + 2] = Math.round(BADGE_RED.r * alpha);
			pixels[i + 3] = Math.round(255 * alpha);
		}
	}
	const glyphs = [...label].map(char => GLYPHS[char]).filter(glyph => glyph !== undefined);
	if (glyphs.length === 0) return pixels;
	// One character drawn larger; two (`9+`) smaller, with a one-cell gap, to stay inside the circle.
	const scale = glyphs.length === 1 ? 4 : 3;
	const width = (glyphs.length * 4 - 1) * scale;
	const left = Math.floor((size - width) / 2);
	const top = Math.floor((size - 5 * scale) / 2);
	glyphs.forEach((rows, index) => {
		rows.forEach((row, rowIndex) => {
			[...row].forEach((cell, column) => {
				if (cell !== '1') return;
				for (let dy = 0; dy < scale; dy++) {
					for (let dx = 0; dx < scale; dx++) {
						const i = ((top + rowIndex * scale + dy) * size + left + (index * 4 + column) * scale + dx) * 4;
						pixels.fill(255, i, i + 4);
					}
				}
			});
		});
	});
	return pixels;
};

type BadgeApp = { dock?: { setBadge: (text: string) => void }; setBadgeCount: (count?: number) => boolean };
type OverlayWindow<Image> = { isDestroyed: () => boolean; setOverlayIcon: (overlay: Image | null, description: string) => void };

type PlatformBadgeOptions<Image> = {
	app: BadgeApp;
	/** The accessible text of the Windows overlay. */
	description: (count: number) => string;
	/** Turns a drawn overlay into the image Electron shows. */
	image: (pixels: Uint8Array) => Image;
	platform: NodeJS.Platform;
	/** The main window, whose taskbar button carries the badge on Windows; null while it is closed. */
	window: () => OverlayWindow<Image> | null;
};

/** Shows a count on the app icon: the Dock on macOS, the launcher on Linux (where the desktop supports it), the taskbar button on Windows. */
export const platformBadge = <Image>(options: PlatformBadgeOptions<Image>): ((count: number) => void) => {
	const overlays = new Map<string, Image>();
	return count => {
		if (options.platform === 'darwin') return options.app.dock?.setBadge(count > 0 ? String(count) : '');
		if (options.platform !== 'win32') return void options.app.setBadgeCount(Math.max(count, 0));
		const window = options.window();
		if (window === null || window.isDestroyed()) return;
		const label = overlayLabel(count);
		if (label === '') return window.setOverlayIcon(null, '');
		let overlay = overlays.get(label);
		if (overlay === undefined) {
			overlay = options.image(drawOverlay(label));
			overlays.set(label, overlay);
		}
		window.setOverlayIcon(overlay, options.description(count));
	};
};
