import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { listVoices, runAssistant, speak, testKey, textModel, transcribe } from '@tempi/ai';
import { type CoreDeps, getProfile, getSettings, initializeSettings, type Language, listReminders, ok, type Reminder, type Settings, systemClock, type Theme, uuidv7Ids } from '@tempi/core';
import { type BackupFile, createRepositories, createTransactionQueue, prepareRestore, swapInRestore, type TransactionQueue, writeBackup } from '@tempi/db';
import { resources } from '@tempi/i18n';
import { type OccurrenceRef, PUSH_CHANNELS } from '@tempi/ipc';
import { createGoogleCalendarApi, GoogleAuthError, GoogleOfflineError, type SyncDeps, syncGoogle } from '@tempi/sync-google';
import {
	app,
	BrowserWindow,
	type BrowserWindowConstructorOptions,
	dialog,
	globalShortcut,
	ipcMain,
	MessageChannelMain,
	Notification,
	nativeImage,
	nativeTheme,
	net,
	powerMonitor,
	protocol,
	safeStorage,
	session,
	shell,
	systemPreferences,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import { createAiService } from './ai/ai-service.js';
import { type AssistantSink, assistantContext, assistantPorts, createAssistantChat } from './ai/assistant-chat.js';
import { createAiKeyStore } from './ai/key-store.js';
import { createAiSettingsStore } from './ai/settings-store.js';
import { APP_ORIGIN, appScheme, handleAppProtocol } from './app-protocol.js';
import { avatarScheme, handleAvatarProtocol } from './avatar-protocol.js';
import { avatarPath, createFileAvatarStore } from './avatar-store.js';
import { CSP_HASHES_FILE, cspHashesSchema, developmentCsp, productionCsp, withCsp } from './csp.js';
import { appDatabasePath, openAppDatabase } from './database.js';
import { openExternalUrl } from './external-links.js';
import { createGoogleAccountService, type GoogleAccountService } from './google/google-account.js';
import { listenForRedirect, redirectPage } from './google/loopback.js';
import { oauthClientFrom } from './google/oauth.js';
import { createSyncRunner, type SyncRunner } from './google/sync-runner.js';
import { type Cipher, createTokenStore } from './google/token-store.js';
import { createIcalWorker } from './ical-worker-client.js';
import { type AiIo, type DataIo, type IcalIo, type IpcSender, type PermissionsIo, registerIpc } from './ipc/register-ipc.js';
import { createMenuBar, TRAY_WINDOW_SIZE } from './menu-bar.js';
import { osPermissionsStatus, systemSettingsUrl } from './os-permissions.js';
import { createPermissionRequestHandler, isPermissionCheckAllowed, microphoneAccess } from './permissions.js';
import { fileReminderCheckpoint } from './reminder-checkpoint.js';
import { createReminderNotifier, deliverNotification, type NotificationApi } from './reminder-notifier.js';
import { createReminderScheduler, type ReminderScheduler } from './reminder-scheduler.js';
import { fetchLatestRelease } from './updates/latest-release.js';
import { createUpdateService, type Downloader, type UpdateService, type UpdateStrategy } from './updates/update-service.js';
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
let googleSync: SyncRunner | null = null;
let appUpdates: UpdateService | null = null;
// The stored language, for text the main process shows itself (the browser page after Google sign-in).
let language: Language = 'en';
// The stored permission preferences, read synchronously by the permission check handler and each reminder.
let preferences: Pick<Settings, 'microphoneEnabled' | 'notificationsEnabled'> = { microphoneEnabled: true, notificationsEnabled: true };
// The saved theme, which a dropped preview goes back to.
let savedTheme: Theme = 'system';

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
function applySettings(settings: Settings) {
	language = settings.language;
	preferences = { microphoneEnabled: settings.microphoneEnabled, notificationsEnabled: settings.notificationsEnabled };
	savedTheme = settings.theme;
	nativeTheme.themeSource = settings.theme;
	menuBar.setEnabled(settings.menuBarEnabled, settings.language);
}

// Seeds the language from the OS on first run, then applies the stored theme before the window exists.
async function loadSettings(deps: CoreDeps, transaction: TransactionQueue) {
	const result = await transaction(() => initializeSettings(deps, app.getPreferredSystemLanguages()));
	if (result.ok) applySettings(result.value);
	else console.error('Failed to initialize settings', result.error);
}

// The build hashes the export's inline scripts next to this bundle (`build:csp`). Without a valid file the app still
// starts, but every inline script is blocked: a broken build fails closed, never open.
async function packagedCsp(): Promise<string> {
	try {
		return productionCsp(cspHashesSchema.parse(JSON.parse(await readFile(path.join(__dirname, CSP_HASHES_FILE), 'utf8'))));
	} catch (error) {
		console.error('Failed to read the inline script hashes; inline scripts will be blocked', error);
		return productionCsp([]);
	}
}

// Packaged, the app protocol sets the policy itself. In dev, the Next server's pages get the dev policy here.
function applyDevelopmentCsp() {
	const policy = developmentCsp(DEV_WEB_URL);
	// Matched against the trusted origin (port included), so only the dev server's own answers get the policy.
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback(isTrustedUrl(details.url) ? { responseHeaders: withCsp(details.responseHeaders ?? {}, policy) } : {});
	});
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

const electronNotifications: NotificationApi = {
	create: options => new Notification(options),
	isSupported: () => Notification.isSupported(),
};

function startReminders(deps: CoreDeps, transaction: TransactionQueue) {
	const notify = createReminderNotifier({
		display: async () => {
			const read = await transaction(async () => ok({ profile: await getProfile(deps), settings: await getSettings(deps) }));
			if (!read.ok) throw new Error(`Failed to read settings for a reminder: ${read.error.issues.map(issue => issue.detail).join('; ')}`);
			const { profile, settings } = read.value;
			// Like the calendar: the profile's zone, or the system's before onboarding.
			return { language: settings.language, timeFormat: settings.timeFormat, timeZone: profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone };
		},
		enabled: () => preferences.notificationsEnabled,
		icon: process.platform === 'darwin' ? undefined : ICON_PNG,
		notifications: electronNotifications,
		onClick: ({ occurrence }) => showInMainWindow({ key: occurrence.key, startAt: occurrence.startAt }),
	});
	const scheduler = createReminderScheduler({
		checkpoint: fileReminderCheckpoint(path.join(app.getPath('userData'), 'reminders.json')),
		listReminders: range => transaction(() => listReminders(deps, range)),
		notify: reminder => void notify(reminder),
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

const ICS_FILTERS = [{ extensions: ['ics'], name: 'iCalendar' }];

// Native dialogs and files for .ics import and export; parsing and writing the text run in a utility process.
function icalIo(): IcalIo {
	const worker = createIcalWorker(path.join(__dirname, 'ical-worker.js'));
	// Dialogs attach to the window that asked, so they open as its sheet on macOS.
	const parent = () => BrowserWindow.getFocusedWindow() ?? mainWindow;
	return {
		chooseExportPath: async defaultName => {
			const options = { defaultPath: path.join(app.getPath('documents'), defaultName), filters: ICS_FILTERS };
			const window = parent();
			const { canceled, filePath } = await (window === null ? dialog.showSaveDialog(options) : dialog.showSaveDialog(window, options));
			return canceled || filePath === undefined || filePath === '' ? null : filePath;
		},
		chooseImportFile: async () => {
			const options = { filters: ICS_FILTERS, properties: ['openFile' as const] };
			const window = parent();
			const { canceled, filePaths } = await (window === null ? dialog.showOpenDialog(options) : dialog.showOpenDialog(window, options));
			const [file] = filePaths;
			return canceled || file === undefined ? null : readFile(file, 'utf8');
		},
		now: () => new Date(),
		parse: async (text, options) => {
			const response = await worker({ kind: 'parse', options, text });
			if (response.kind === 'parsed') return response.result;
			throw new Error(response.kind === 'failed' ? response.detail : `Unexpected ${response.kind} answer to parse`);
		},
		serialize: async (data, now) => {
			const response = await worker({ data, kind: 'serialize', now: now.toISOString() });
			if (response.kind === 'serialized') return response.text;
			throw new Error(response.kind === 'failed' ? response.detail : `Unexpected ${response.kind} answer to serialize`);
		},
		writeFile: (file, text) => writeFile(file, text, 'utf8'),
	};
}

const BACKUP_FILTERS = [{ extensions: ['db'], name: 'Tempi backup' }];

// Backups are the database file plus the profile photo; a restore swaps the file in and relaunches on it.
function dataIo(db: DatabaseSync, deps: CoreDeps, transaction: TransactionQueue, avatarsDir: string): DataIo {
	const parent = () => BrowserWindow.getFocusedWindow() ?? mainWindow;
	return {
		backup: target =>
			// Between transactions: VACUUM INTO can't run inside one.
			transaction.exclusive(async () => {
				const profile = await deps.profile.get();
				const photo = profile?.avatar == null ? null : avatarPath(avatarsDir, profile.avatar);
				const files: BackupFile[] = [];
				if (profile?.avatar != null && photo !== null) {
					const bytes = await readFile(photo).catch(() => null);
					if (bytes !== null) files.push({ bytes, name: profile.avatar });
				}
				writeBackup(db, target, files);
			}),
		chooseBackupPath: async defaultName => {
			const options = { defaultPath: path.join(app.getPath('documents'), defaultName), filters: BACKUP_FILTERS };
			const window = parent();
			const { canceled, filePath } = await (window === null ? dialog.showSaveDialog(options) : dialog.showSaveDialog(window, options));
			return canceled || filePath === undefined || filePath === '' ? null : filePath;
		},
		chooseRestoreFile: async () => {
			const options = { filters: BACKUP_FILTERS, properties: ['openFile' as const] };
			const window = parent();
			const { canceled, filePaths } = await (window === null ? dialog.showOpenDialog(options) : dialog.showOpenDialog(window, options));
			const [file] = filePaths;
			return canceled || file === undefined ? null : file;
		},
		now: () => new Date(),
		restore: async source => {
			const live = appDatabasePath();
			// Everything that can fail on a bad file happens on a staged copy, before the current data is touched.
			const prepared = await prepareRestore(source, `${live}.restoring`);
			if (!prepared.ok) return prepared;
			try {
				// Not awaited: a sync waiting on the transactions would wait on this one too.
				void googleSync?.stop();
				googleSync = null;
				await transaction.exclusive(async () => {
					reminders?.stop();
					reminders = null;
					db.close();
					database = null;
					swapInRestore(`${live}.restoring`, live);
					for (const file of prepared.value.files) {
						const target = avatarPath(avatarsDir, file.name);
						if (target === null) continue;
						await mkdir(avatarsDir, { recursive: true });
						await writeFile(target, file.bytes);
					}
				});
			} finally {
				// Restored or not, the database is closed now: start again on whichever file is in place. The delay lets the answer reach the window.
				setTimeout(() => {
					app.relaunch();
					app.exit(0);
				}, 300);
			}
			return ok(null);
		},
	};
}

// On Linux without a keyring, safeStorage falls back to a hardcoded key; that protects nothing, so tokens aren't stored.
const safeStorageCipher: Cipher = {
	decrypt: data => safeStorage.decryptString(data),
	encrypt: text => safeStorage.encryptString(text),
	isAvailable: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
};

// The OAuth client is inlined at build time (`bun build --env`) from the maintainer's environment, never committed.
function googleAccount(): GoogleAccountService {
	return createGoogleAccountService({
		client: oauthClientFrom({ id: process.env.TEMPI_GOOGLE_CLIENT_ID, secret: process.env.TEMPI_GOOGLE_CLIENT_SECRET }),
		// Chromium's network stack, so system proxies and certificates apply.
		fetch: (url, init) => net.fetch(url, init),
		listen: listenForRedirect,
		now: () => new Date(),
		openBrowser: url => shell.openExternal(url),
		page: succeeded => {
			const texts = resources[language].common.settings.integrations;
			return redirectPage('Tempi', succeeded ? texts.browserDone : texts.browserFailed);
		},
		store: createTokenStore(path.join(app.getPath('userData'), 'google-account.bin'), safeStorageCipher),
	});
}

// AI provider keys, encrypted like the Google tokens; the choices beside them in plain JSON.
function aiIo(deps: CoreDeps, transaction: TransactionQueue): AiIo {
	const userData = app.getPath('userData');
	const keys = createAiKeyStore(path.join(userData, 'ai-keys.bin'), safeStorageCipher);
	const settings = createAiSettingsStore(path.join(userData, 'ai-settings.json'));
	return {
		chat: createAssistantChat({
			context: assistantContext(deps, transaction, () => new Date()),
			keys,
			model: textModel,
			ports: assistantPorts(deps, transaction),
			run: runAssistant,
			settings,
		}),
		openStream: openAssistantStream,
		service: createAiService({
			keys,
			providers: {
				listVoices: key => listVoices(key),
				speak: (key, request) => speak(key, request),
				testKey: (provider, key) => testKey(provider, key),
				transcribe: (key, request) => transcribe(key, request),
			},
			settings,
		}),
	};
}

// The OS side of the permissions settings. The privacy pages are fixed per platform; the renderer only names a permission.
function permissionsIo(): PermissionsIo {
	return {
		openSystemSettings: async permission => {
			const url = systemSettingsUrl(process.platform, permission);
			if (url === null) return false;
			await shell.openExternal(url);
			return true;
		},
		status: () => osPermissionsStatus(process.platform, systemPreferences, Notification.isSupported()),
		// The first notification is what makes macOS ask whether Tempi may show them.
		testNotification: () => {
			const texts = resources[language].common.onboarding.reminders;
			return deliverNotification(electronNotifications, { body: texts.testBody, title: texts.testTitle, ...(process.platform === 'darwin' ? {} : { icon: ICON_PNG }) });
		},
	};
}

// Deny every permission by default; only dictation's microphone, for the app itself and while the user allows it in
// Tempi, is allowed (asking macOS first).
function restrictPermissions() {
	const microphoneEnabled = () => preferences.microphoneEnabled;
	const request = createPermissionRequestHandler({ isTrusted: isTrustedUrl, microphoneAccess: microphoneAccess(process.platform, systemPreferences), microphoneEnabled });
	session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
		const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
		void request({ mediaTypes, permission, requestingUrl: details.requestingUrl }).then(callback);
	});
	session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) =>
		isPermissionCheckAllowed({ mediaType: details.mediaType, permission, requestingOrigin }, { isTrusted: isTrustedUrl, microphoneEnabled })
	);
}

// One MessagePort per reply: the renderer reads events from its end, and closing it aborts the reply here.
function openAssistantStream(sender: IpcSender, requestId: string): AssistantSink {
	const { port1, port2 } = new MessageChannelMain();
	const controller = new AbortController();
	port1.on('close', () => controller.abort());
	port1.start();
	sender.senderFrame?.postMessage?.(PUSH_CHANNELS.ai.chatPort, { requestId }, [port2]);
	return { close: () => port1.close(), send: event => port1.postMessage(event), signal: controller.signal };
}

// Two-way Google Calendar sync while an account is connected. Google is called between transactions, never inside one.
function createGoogleSync(deps: CoreDeps, transaction: TransactionQueue, account: GoogleAccountService): SyncRunner {
	const api = createGoogleCalendarApi({
		accessToken: async () => {
			const token = await account.accessToken();
			if (token.ok) return token.value;
			const [issue] = token.error.issues;
			if (issue?.key === 'google.offline') throw new GoogleOfflineError(issue.detail);
			if (issue?.key === 'google.reconnectRequired') throw new GoogleAuthError(issue.detail);
			throw new Error(issue?.detail ?? 'No Google access token');
		},
		fetch: (url, init) => net.fetch(url, init),
	});
	const transact = async <T>(work: (syncDeps: SyncDeps) => Promise<T>): Promise<T> => {
		const result = await transaction(async () => ok(await work(deps)));
		if (!result.ok) throw new Error(result.error.issues.map(issue => issue.detail).join('; '));
		return result.value;
	};
	return createSyncRunner({
		now: () => new Date(),
		onStatus: (status, summary) => {
			for (const window of BrowserWindow.getAllWindows()) window.webContents.send(PUSH_CHANNELS.google.syncStatus, status);
			if (summary !== null && summary.pulled > 0) void reminders?.reschedule();
		},
		setTimer: (callback, ms) => {
			const timer = setTimeout(callback, ms);
			return () => clearTimeout(timer);
		},
		sync: () => syncGoogle({ api, transact }),
	});
}

// electron-updater against the GitHub Releases in `build.publish`: downloads in the background and installs on quit.
function electronDownloader(): Downloader {
	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;
	// Its own logger prints every step; failures already reach the update status.
	autoUpdater.logger = null;
	return {
		check: async () => {
			await autoUpdater.checkForUpdates();
		},
		install: () => autoUpdater.quitAndInstall(),
		subscribe: listener => {
			autoUpdater.on('update-available', info => listener({ type: 'available', version: info.version }));
			autoUpdater.on('update-not-available', () => listener({ type: 'notAvailable' }));
			autoUpdater.on('update-downloaded', info => listener({ type: 'downloaded', version: info.version }));
			autoUpdater.on('error', error => listener({ error, type: 'error' }));
		},
	};
}

// Squirrel.Mac only installs updates signed with an Apple Developer ID, and among Linux packages only the AppImage can
// replace itself: those builds point at the newest release instead. A development run doesn't update.
function updateStrategy(): UpdateStrategy {
	if (!app.isPackaged) return { kind: 'unsupported' };
	if (process.platform === 'win32' || (process.platform === 'linux' && process.env.APPIMAGE !== undefined)) return { downloader: electronDownloader(), kind: 'download' };
	return { kind: 'notify', latestRelease: () => fetchLatestRelease((url, init) => net.fetch(url, init)) };
}

function createUpdates(): UpdateService {
	return createUpdateService({
		currentVersion: app.getVersion(),
		now: () => new Date(),
		onStatus: status => {
			for (const window of BrowserWindow.getAllWindows()) window.webContents.send(PUSH_CHANNELS.updates.status, status);
		},
		setTimer: (callback, ms) => {
			const timer = setTimeout(callback, ms);
			return () => clearTimeout(timer);
		},
		strategy: updateStrategy(),
	});
}

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
		if (app.isPackaged) handleAppProtocol(WEB_DIR, await packagedCsp());
		else applyDevelopmentCsp();
		restrictPermissions();
		const avatarsDir = path.join(app.getPath('userData'), 'avatars');
		handleAvatarProtocol(avatarsDir);
		database = openAppDatabase();
		const transaction = createTransactionQueue(database);
		const deps: CoreDeps = { ...createRepositories(database), avatars: createFileAvatarStore(avatarsDir), clock: systemClock, ids: uuidv7Ids };
		const account = googleAccount();
		const sync = createGoogleSync(deps, transaction, account);
		googleSync = sync;
		const updates = createUpdates();
		appUpdates = updates;
		registerIpc(
			{ ipc: ipcMain, isTrusted: isTrustedUrl, transaction },
			deps,
			{ ai: aiIo(deps, transaction), data: dataIo(database, deps, transaction, avatarsDir), google: { account, sync }, ical: icalIo(), permissions: permissionsIo(), updates },
			{
				eventsChanged: () => {
					void reminders?.reschedule();
					googleSync?.schedule();
				},
				settingsSaved: applySettings,
				// Previewing "system" must show the OS theme, which the renderer only sees once `themeSource` follows the preview.
				themePreviewed: theme => {
					nativeTheme.themeSource = theme ?? savedTheme;
				},
				showEvent: showInMainWindow,
			}
		);
		await loadSettings(deps, transaction);
		createWindow();
		reminders = startReminders(deps, transaction);
		if ((await account.account()) !== null) sync.start();
		updates.start();
		// Edits made offline go out once the computer is back, and timers stall while it sleeps.
		powerMonitor.on('resume', () => void googleSync?.syncNow());
	});

	app.on('before-quit', () => {
		reminders?.stop();
		reminders = null;
		void googleSync?.stop();
		googleSync = null;
		appUpdates?.stop();
		appUpdates = null;
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
