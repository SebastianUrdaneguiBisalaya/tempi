type Rect = { height: number; width: number; x: number; y: number };

/** Space between the tray window and the menu bar, taskbar or screen edge. */
const GAP = 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Where to put the tray window: centered on the tray icon, just below a menu bar at the top (macOS, some Linux
 * desktops) or just above a taskbar at the bottom (Windows), always inside the work area. Some Linux trays report
 * empty bounds; the window then goes to the work area's top-right corner.
 */
export const trayWindowPosition = (tray: Rect, size: { height: number; width: number }, workArea: Rect): { x: number; y: number } => {
	const right = workArea.x + workArea.width - size.width - GAP;
	const bottom = workArea.y + workArea.height - size.height - GAP;
	if (tray.width === 0 || tray.height === 0) return { x: right, y: workArea.y + GAP };

	const trayIsAbove = tray.y + tray.height / 2 < workArea.y + workArea.height / 2;
	const x = tray.x + tray.width / 2 - size.width / 2;
	const y = trayIsAbove ? Math.max(tray.y + tray.height, workArea.y) + GAP : Math.min(tray.y, workArea.y + workArea.height) - size.height - GAP;
	return { x: Math.round(clamp(x, workArea.x + GAP, right)), y: Math.round(clamp(y, workArea.y + GAP, bottom)) };
};
