import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { type CoreDeps, getProfile, getSettings, initializeSettings, listReminders, ok, type Reminder, type Settings, systemClock, uuidv7Ids } from '@tempi/core';
import { createRepositories, createTransactionQueue, type TransactionQueue } from '@tempi/db';
import { type OccurrenceRef, PUSH_CHANNELS } from '@tempi/ipc';
import { app, BrowserWindow, type BrowserWindowConstructorOptions, globalShortcut, ipcMain, nativeImage, nativeTheme, powerMonitor, protocol, shell } from 'electron';
import { APP_ORIGIN, appScheme, handleAppProtocol } from './app-protocol.js';
import { avatarScheme, handleAvatarProtocol } from './avatar-protocol.js';
import { createFileAvatarStore } from './avatar-store.js';
import { openAppDatabase } from './database.js';
import { openExternalUrl } from './external-links.js';
import { registerIpc } from './ipc/register-ipc.js';
import { createMenuBar, TRAY_WINDOW_SIZE } from './menu-bar.js';
import { fileReminderCheckpoint } from './reminder-checkpoint.js';
import { createReminderNotifier } from './reminder-notifier.js';
import { createReminderScheduler, type ReminderScheduler } from './reminder-scheduler.js';
import { loadWindowState, trackWindowState, windowOptions } from './window-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Packaged: the static export of @tempi/web bundled in the app, served from app://tempi.
// Dev: the Next dev server (`bun run dev:web`), or another URL through TEMPI_WEB_URL.
const DEV_WEB_URL = (process.env.TEMPI_WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const WEB_URL = app.isPackaged ? APP_ORIGIN : DEV_WEB_URL;
const WEB_DIR = path.join(process.resourcesPath, 'web');

// Chromium's net::ERR_CONNECTION_REFUSED: the dev server is not up yet.
const ERR_CONNECTION_REFUSED = -102;
const DEV_RETRY_MS = 1000;

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ICON_PNG = path.join(PUBLIC_DIR, 'tempi-icon.png');
const ICON_MAC_PNG = path.join(PUBLIC_DIR, 'tempi-icon-mac.png');
// macOS tints a `…Template.png` to match the menu bar; Windows and Linux show the icon as is.
const TRAY_ICON = path.join(PUBLIC_DIR, process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png');

// Must match `build.appId` in package.json: Windows shows notifications only for the app's registered AppUserModelID.
const APP_ID = 'com.sebastianurdanegui.tempi';

// Matches the web app's --background in each theme, so the window never flashes the wrong color before the first paint.
const BACKGROUND = { dark: '#0a0a0a', light: '#ffffff' } as const;

// Electron keeps only the last registration, so every privileged scheme goes in this single call.
protocol.registerSchemesAsPrivileged([appScheme, avatarScheme]);

let mainWindow: BrowserWindow | null = null;
let database: DatabaseSync | null = null;
let reminders: ReminderScheduler | null = null;

function isTrustedUrl(url: string) {
	return url === WEB_URL || url.startsWith(`${WEB_URL}/`);
}

function loadWebApp() {
	mainWindow?.loadURL(`${WEB_URL}/`).catch(error => {
		// A refused dev connection is retried from `did-fail-load`.
		if (!app.isPackaged && error?.errno === ERR_CONNECTION_REFUSED) return;
		console.error('Failed to load web app', error);
	});
}

// The renderer's `prefers-color-scheme`, native menus and dialogs all follow `themeSource`.
function applySettings(settings: Pick<Settings, 'language' | 'menuBarEnabled' | 'theme'>) {
	nativeTheme.themeSource = settings.theme;
	menuBar.setEnabled(settings.menuBarEnabled, settings.language);
}

// Seeds the language from the OS on first run, then applies the stored theme before the window exists.
async function loadSettings(deps: CoreDeps, transaction: TransactionQueue) {
	const result = await transaction(() => initializeSettings(deps, app.getPreferredSystemLanguages()));
	if (result.ok) applySettings(result.value);
	else console.error('Failed to initialize settings', result.error);
}

// Every window gets the same hardened renderer and navigation rules: the menu bar calendar is as locked down as the main window.
function createSecureWindow(options: BrowserWindowConstructorOptions): BrowserWindow {
	const window = new BrowserWindow({
		...options,
		backgroundColor: nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light,
		show: false,
		webPreferences: {
			allowRunningInsecureContent: false,
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.cjs'),
			sandbox: true,
			spellcheck: false,
			webSecurity: true,
		},
	});

	// Never let the renderer open arbitrary windows/navigations to a
	// different origin - only our own local app URL is allowed in-app,
	// http(s) and mailto links go to the OS, and anything else is dropped.
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (!isTrustedUrl(url)) {
			openExternalUrl(url, shell.openExternal);
			return {
				action: 'deny',
			};
		}
		return {
			action: 'allow',
		};
	});

	window.webContents.on('will-navigate', (event, url) => {
		if (!isTrustedUrl(url)) {
			event.preventDefault();
			openExternalUrl(url, shell.openExternal);
		}
	});

	return window;
}

function createWindow() {
	const windowState = loadWindowState();

	mainWindow = createSecureWindow({
		...windowOptions(windowState),
		// macOS takes the icon from the app bundle (.icns); Windows and Linux use the window icon.
		...(process.platform === 'darwin' ? {} : { icon: ICON_PNG }),
	});

	trackWindowState(mainWindow);

	// Reopen how the user left it; the first launch fills the work area
	// (maximized, not fullscreen: menu bar/taskbar and dock stay visible).
	mainWindow.once('ready-to-show', () => {
		if (windowState.isMaximized) mainWindow?.maximize();
		mainWindow?.show();
	});

	// In dev, Electron may start before `next dev` is listening: keep retrying until it answers.
	mainWindow.webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
		if (app.isPackaged || !isMainFrame || errorCode !== ERR_CONNECTION_REFUSED) return;
		setTimeout(() => loadWebApp(), DEV_RETRY_MS);
	});

	loadWebApp();

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

// The menu bar calendar: a small frameless window that hides when it loses focus. Loaded once, then shown and hidden.
function createTrayWindow() {
	const window = createSecureWindow({
		...TRAY_WINDOW_SIZE,
		alwaysOnTop: true,
		frame: false,
		fullscreenable: false,
		maximizable: false,
		minimizable: false,
		movable: false,
		resizable: false,
		skipTaskbar: true,
	});
	// Opens over whatever space or full-screen app is in front, like other menu bar extras.
	if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
	window.loadURL(`${WEB_URL}/tray`).catch(error => console.error('Failed to load the menu bar calendar', error));
	return window;
}

const menuBar = createMenuBar({ createWindow: createTrayWindow, iconPath: TRAY_ICON, openApp: () => showMainWindow(), quit: () => app.quit() });

// Brings the main window forward, reopening it if it was closed.
function showMainWindow(): BrowserWindow | null {
	if (mainWindow === null) createWindow();
	const window = mainWindow;
	if (window === null) return null;
	if (window.isMinimized()) window.restore();
	window.show();
	window.focus();
	if (process.platform === 'darwin') app.focus({ steal: true });
	return window;
}

// Shows an occurrence in the main window (a clicked reminder, an event picked in the menu bar) once the page can take it.
function showInMainWindow(ref: OccurrenceRef) {
	menuBar.hide();
	const window = showMainWindow();
	if (window === null) return;
	const send = () => window.webContents.send(PUSH_CHANNELS.events.show, ref);
	if (window.webContents.isLoading()) window.webContents.once('did-finish-load', send);
	else send();
}

function startReminders(deps: CoreDeps, transaction: TransactionQueue) {
	const notify = createReminderNotifier({
		display: async () => {
			const read = await transaction(async () => ok({ profile: await getProfile(deps), settings: await getSettings(deps) }));
			if (!read.ok) throw new Error(`Failed to read settings for a reminder: ${read.error.issues.map(issue => issue.detail).join('; ')}`);
			const { profile, settings } = read.value;
			// Like the calendar: the profile's zone, or the system's before onboarding.
			return { language: settings.language, timeFormat: settings.timeFormat, timeZone: profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone };
		},
		icon: process.platform === 'darwin' ? undefined : ICON_PNG,
		onClick: ({ occurrence }) => showInMainWindow({ key: occurrence.key, startAt: occurrence.startAt }),
	});
	const scheduler = createReminderScheduler({
		checkpoint: fileReminderCheckpoint(path.join(app.getPath('userData'), 'reminders.json')),
		listReminders: range => transaction(() => listReminders(deps, range)),
		notify,
		now: () => new Date(),
		setTimer: (callback, ms) => {
			const timer = setTimeout(callback, ms);
			return () => clearTimeout(timer);
		},
	});
	// Timers stall while the computer sleeps: check on wake, firing what came due meanwhile.
	powerMonitor.on('resume', () => void scheduler.reschedule());
	void scheduler.reschedule();
	return scheduler;
}

if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
	// Another instance is already running - let it keep running and quit this one.
	app.quit();
} else {
	app.on('second-instance', () => showMainWindow());

	app.whenReady().then(async () => {
		// In dev the app runs inside the stock Electron bundle, so set the dock icon explicitly.
		// A PNG through nativeImage is more reliable than an .icns path here.
		if (process.platform === 'darwin' && !app.isPackaged) {
			const dockIcon = nativeImage.createFromPath(ICON_MAC_PNG);
			if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
		}
		if (app.isPackaged) handleAppProtocol(WEB_DIR);
		const avatarsDir = path.join(app.getPath('userData'), 'avatars');
		handleAvatarProtocol(avatarsDir);
		database = openAppDatabase();
		const transaction = createTransactionQueue(database);
		const deps: CoreDeps = { ...createRepositories(database), avatars: createFileAvatarStore(avatarsDir), clock: systemClock, ids: uuidv7Ids };
		registerIpc({ ipc: ipcMain, isTrusted: isTrustedUrl, transaction }, deps, { eventsChanged: () => void reminders?.reschedule(), settingsSaved: applySettings, showEvent: showInMainWindow });
		await loadSettings(deps, transaction);
		createWindow();
		reminders = startReminders(deps, transaction);
	});

	app.on('before-quit', () => {
		reminders?.stop();
		reminders = null;
		database?.close();
		database = null;
	});

	app.on('will-quit', () => globalShortcut.unregisterAll());

	// With the menu bar calendar on, Windows and Linux keep running in the tray once the main window closes.
	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin' && !menuBar.isEnabled()) app.quit();
	});

	// The hidden menu bar window counts as a window, so check for the main one.
	app.on('activate', () => {
		if (mainWindow === null) createWindow();
	});
}
