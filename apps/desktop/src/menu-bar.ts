import type { Language } from '@tempi/core';
import { resources } from '@tempi/i18n';
import { type BrowserWindow, globalShortcut, Menu, nativeImage, screen, Tray } from 'electron';
import { trayWindowPosition } from './tray-window-position.js';

/** ⌥⌘K on macOS, Alt+Ctrl+K on Windows and Linux. */
export const MENU_BAR_SHORTCUT = 'Alt+CommandOrControl+K';

// Tall enough for a six-week month at full width and a few of the day's events below it.
export const TRAY_WINDOW_SIZE = { height: 540, width: 320 };

// Clicking the tray icon while the window is open first blurs (hiding it), then clicks: without this the click
// would reopen what the user just meant to close.
const REOPEN_GUARD_MS = 300;

type MenuBarOptions = {
	/** A hidden, frameless window with the app's security settings, loading the tray page. */
	createWindow: () => BrowserWindow;
	/** A monochrome template image on macOS (it follows the menu bar's color), a regular icon elsewhere. */
	iconPath: string;
	openApp: () => void;
	quit: () => void;
};

export type MenuBar = {
	hide: () => void;
	isEnabled: () => boolean;
	/** Shows or removes the tray icon and its global shortcut; the menu follows `language`. */
	setEnabled: (enabled: boolean, language: Language) => void;
};

/** The menu bar (macOS) or tray (Windows, Linux) calendar: an icon that toggles a small window with today's agenda. */
export const createMenuBar = (options: MenuBarOptions): MenuBar => {
	let tray: Tray | null = null;
	let window: BrowserWindow | null = null;
	let hiddenAt = 0;

	const hide = () => {
		if (window === null || !window.isVisible()) return;
		window.hide();
		hiddenAt = Date.now();
	};

	const show = () => {
		if (window === null || window.isDestroyed()) {
			const created = options.createWindow();
			created.on('blur', hide);
			created.on('closed', () => {
				if (window === created) window = null;
			});
			window = created;
		}
		const trayBounds = tray?.getBounds() ?? { height: 0, width: 0, x: 0, y: 0 };
		// Empty tray bounds (some Linux desktops) say nothing about the screen: use the one under the pointer.
		const display = trayBounds.width === 0 ? screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) : screen.getDisplayMatching(trayBounds);
		const { x, y } = trayWindowPosition(trayBounds, TRAY_WINDOW_SIZE, display.workArea);
		window.setPosition(x, y);
		window.show();
		window.focus();
	};

	const toggle = () => {
		if (window?.isVisible()) hide();
		else if (Date.now() - hiddenAt > REOPEN_GUARD_MS) show();
	};

	const contextMenu = (language: Language) => {
		const labels = resources[language].common.tray;
		return Menu.buildFromTemplate([
			{ accelerator: MENU_BAR_SHORTCUT, click: show, label: labels.showAgenda },
			{ click: options.openApp, label: labels.openApp },
			{ type: 'separator' },
			{ click: options.quit, label: labels.quit },
		]);
	};

	const disable = () => {
		globalShortcut.unregister(MENU_BAR_SHORTCUT);
		tray?.destroy();
		tray = null;
		window?.destroy();
		window = null;
	};

	const enable = (language: Language) => {
		if (tray === null) {
			const icon = nativeImage.createFromPath(options.iconPath);
			if (icon.isEmpty()) console.warn(`Menu bar icon not found at ${options.iconPath}`);
			tray = new Tray(icon);
			tray.setToolTip('Tempi');
			// Without an icon, a title keeps the menu bar item visible and clickable (macOS only).
			if (icon.isEmpty() && process.platform === 'darwin') tray.setTitle('Tempi');
			tray.on('click', toggle);
			if (!globalShortcut.isRegistered(MENU_BAR_SHORTCUT) && !globalShortcut.register(MENU_BAR_SHORTCUT, toggle)) {
				console.warn(`Could not register ${MENU_BAR_SHORTCUT}: another app may be using it`);
			}
		}
		const menu = contextMenu(language);
		// Linux trays only open a menu (they emit no clicks); macOS and Windows keep the left click for the agenda.
		if (process.platform === 'linux') tray.setContextMenu(menu);
		else {
			tray.removeAllListeners('right-click');
			tray.on('right-click', () => tray?.popUpContextMenu(menu));
		}
	};

	return {
		hide,
		isEnabled: () => tray !== null,
		setEnabled: (enabled, language) => (enabled ? enable(language) : disable()),
	};
};
