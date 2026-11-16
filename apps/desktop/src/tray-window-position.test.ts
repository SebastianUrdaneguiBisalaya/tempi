import { describe, expect, test } from 'bun:test';
import { trayWindowPosition } from './tray-window-position';

const SIZE = { height: 480, width: 320 };

describe('trayWindowPosition', () => {
	test('drops below a menu bar icon, centered on it (macOS)', () => {
		const workArea = { height: 1095, width: 1920, x: 0, y: 25 };
		expect(trayWindowPosition({ height: 24, width: 30, x: 1500, y: 0 }, SIZE, workArea)).toEqual({ x: 1355, y: 29 });
	});

	test('rises above a taskbar icon at the bottom (Windows)', () => {
		const workArea = { height: 1040, width: 1920, x: 0, y: 0 };
		expect(trayWindowPosition({ height: 40, width: 24, x: 1700, y: 1040 }, SIZE, workArea)).toEqual({ x: 1552, y: 556 });
	});

	test('stays inside the work area near its edge', () => {
		const workArea = { height: 1040, width: 1920, x: 0, y: 0 };
		expect(trayWindowPosition({ height: 40, width: 24, x: 1890, y: 1040 }, SIZE, workArea).x).toBe(1596);
	});

	test('uses the top-right corner when the tray reports no bounds (some Linux desktops)', () => {
		const workArea = { height: 1053, width: 2560, x: 1920, y: 27 };
		expect(trayWindowPosition({ height: 0, width: 0, x: 0, y: 0 }, SIZE, workArea)).toEqual({ x: 4156, y: 31 });
	});
});
