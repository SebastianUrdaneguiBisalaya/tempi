import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { type CoreDeps, initializeSettings, type Settings, systemClock, uuidv7Ids } from '@tempi/core';
import { createRepositories, createTransactionQueue, type TransactionQueue } from '@tempi/db';
import { app, BrowserWindow, ipcMain, nativeImage, nativeTheme, protocol, shell } from 'electron';
import { APP_ORIGIN, appScheme, handleAppProtocol } from './app-protocol.js';
import { avatarScheme, handleAvatarProtocol } from './avatar-protocol.js';
import { createFileAvatarStore } from './avatar-store.js';
import { openAppDatabase } from './database.js';
import { openExternalUrl } from './external-links.js';
import { registerIpc } from './ipc/register-ipc.js';
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

// Matches the web app's --background in each theme, so the window never flashes the wrong color before the first paint.
const BACKGROUND = { dark: '#0a0a0a', light: '#ffffff' } as const;

// Electron keeps only the last registration, so every privileged scheme goes in this single call.
protocol.registerSchemesAsPrivileged([appScheme, avatarScheme]);

let mainWindow: BrowserWindow | null = null;
let database: DatabaseSync | null = null;

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
function applySettings(settings: Pick<Settings, 'theme'>) {
	nativeTheme.themeSource = settings.theme;
}

// Seeds the language from the OS on first run, then applies the stored theme before the window exists.
async function loadSettings(deps: CoreDeps, transaction: TransactionQueue) {
	const result = await transaction(() => initializeSettings(deps, app.getPreferredSystemLanguages()));
	if (result.ok) applySettings(result.value);
	else console.error('Failed to initialize settings', result.error);
}

function createWindow() {
	const windowState = loadWindowState();

	mainWindow = new BrowserWindow({
		...windowOptions(windowState),
		// macOS takes the icon from the app bundle (.icns); Windows and Linux use the window icon.
		...(process.platform === 'darwin' ? {} : { icon: ICON_PNG }),
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

	trackWindowState(mainWindow);

	// Never let the renderer open arbitrary windows/navigations to a
	// different origin - only our own local app URL is allowed in-app,
	// http(s) and mailto links go to the OS, and anything else is dropped.
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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

	mainWindow.webContents.on('will-navigate', (event, url) => {
		if (!isTrustedUrl(url)) {
			event.preventDefault();
			openExternalUrl(url, shell.openExternal);
		}
	});

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

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
	// Another instance is already running - let it keep running and quit this one.
	app.quit();
} else {
	app.on('second-instance', () => {
		if (!mainWindow) return;
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
	});

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
		registerIpc({ ipc: ipcMain, isTrusted: isTrustedUrl, transaction }, deps, { settingsSaved: applySettings });
		await loadSettings(deps, transaction);
		createWindow();
	});

	app.on('before-quit', () => {
		database?.close();
		database = null;
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') app.quit();
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
}
