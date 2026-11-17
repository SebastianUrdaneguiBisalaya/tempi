// Bundled to CommonJS (dist/preload.cjs) on purpose: sandboxed preloads cannot be ES modules or require local files.
import { CHANNELS, type DesktopApi, PUSH_CHANNELS } from '@tempi/ipc';
import { contextBridge, ipcRenderer } from 'electron';

// Only small, typed functions, one per use case: never `ipcRenderer`, a generic invoke or any Node API.
// Payloads are validated in the main process and answers in the renderer client, so nothing here is trusted.
// An occurrence to show can arrive before the page has subscribed (e.g. the window was reopened for it), so keep the
// latest one until a listener takes it.
type ShowEventListener = (ref: unknown) => void;
const showEventListeners = new Set<ShowEventListener>();
let pendingShowEvent: { ref: unknown } | null = null;
ipcRenderer.on(PUSH_CHANNELS.events.show, (_event, ref: unknown) => {
	if (showEventListeners.size === 0) pendingShowEvent = { ref };
	for (const listener of showEventListeners) listener(ref);
});

type SyncStatusListener = (status: unknown) => void;
const syncStatusListeners = new Set<SyncStatusListener>();
ipcRenderer.on(PUSH_CHANNELS.google.syncStatus, (_event, status: unknown) => {
	for (const listener of syncStatusListeners) listener(status);
});

type UpdateStatusListener = (status: unknown) => void;
const updateStatusListeners = new Set<UpdateStatusListener>();
ipcRenderer.on(PUSH_CHANNELS.updates.status, (_event, status: unknown) => {
	for (const listener of updateStatusListeners) listener(status);
});

// Each assistant reply streams on its own MessagePort. A port can't cross the context bridge, so the preload keeps
// it and forwards each message to the page's listener; closing it (stopChat) tells the main process to stop.
type ChatListener = (event: unknown) => void;
const chatListeners = new Map<string, ChatListener>();
const chatPorts = new Map<string, MessagePort>();
ipcRenderer.on(PUSH_CHANNELS.ai.chatPort, (event, message: unknown) => {
	const port = event.ports[0];
	if (port === undefined) return;
	const requestId = typeof message === 'object' && message !== null && 'requestId' in message && typeof message.requestId === 'string' ? message.requestId : null;
	const listener = requestId === null ? undefined : chatListeners.get(requestId);
	// A reply nobody waits for any more (stopped before its port arrived) is stopped right away.
	if (requestId === null || listener === undefined) {
		port.close();
		return;
	}
	chatPorts.set(requestId, port);
	port.onmessage = ({ data }) => listener(data);
	port.start();
});

const stopChat = (requestId: string) => {
	chatListeners.delete(requestId);
	chatPorts.get(requestId)?.close();
	chatPorts.delete(requestId);
};

const desktop: DesktopApi = {
	ai: {
		chat: (input, listener) => {
			const requestId = typeof input === 'object' && input !== null && 'requestId' in input && typeof input.requestId === 'string' ? input.requestId : null;
			if (requestId !== null) chatListeners.set(requestId, listener);
			return ipcRenderer.invoke(CHANNELS.ai.chat, input);
		},
		getSettings: () => ipcRenderer.invoke(CHANNELS.ai.getSettings),
		listVoices: () => ipcRenderer.invoke(CHANNELS.ai.listVoices),
		removeKey: provider => ipcRenderer.invoke(CHANNELS.ai.removeKey, provider),
		saveKey: input => ipcRenderer.invoke(CHANNELS.ai.saveKey, input),
		saveSettings: patch => ipcRenderer.invoke(CHANNELS.ai.saveSettings, patch),
		stopChat,
		testKey: provider => ipcRenderer.invoke(CHANNELS.ai.testKey, provider),
		transcribe: input => ipcRenderer.invoke(CHANNELS.ai.transcribe, input),
	},
	app: {
		onShowEvent: listener => {
			showEventListeners.add(listener);
			if (pendingShowEvent !== null) {
				listener(pendingShowEvent.ref);
				pendingShowEvent = null;
			}
			return () => {
				showEventListeners.delete(listener);
			};
		},
		showEvent: ref => ipcRenderer.invoke(CHANNELS.app.showEvent, ref),
	},
	calendars: {
		create: input => ipcRenderer.invoke(CHANNELS.calendars.create, input),
		delete: input => ipcRenderer.invoke(CHANNELS.calendars.delete, input),
		export: input => ipcRenderer.invoke(CHANNELS.calendars.export, input),
		import: input => ipcRenderer.invoke(CHANNELS.calendars.import, input),
		list: () => ipcRenderer.invoke(CHANNELS.calendars.list),
		update: input => ipcRenderer.invoke(CHANNELS.calendars.update, input),
	},
	data: {
		backup: () => ipcRenderer.invoke(CHANNELS.data.backup),
		restore: () => ipcRenderer.invoke(CHANNELS.data.restore),
	},
	events: {
		create: input => ipcRenderer.invoke(CHANNELS.events.create, input),
		delete: id => ipcRenderer.invoke(CHANNELS.events.delete, id),
		deleteOccurrence: input => ipcRenderer.invoke(CHANNELS.events.deleteOccurrence, input),
		duplicate: id => ipcRenderer.invoke(CHANNELS.events.duplicate, id),
		list: range => ipcRenderer.invoke(CHANNELS.events.list, range),
		restore: id => ipcRenderer.invoke(CHANNELS.events.restore, id),
		search: query => ipcRenderer.invoke(CHANNELS.events.search, query),
		update: input => ipcRenderer.invoke(CHANNELS.events.update, input),
		updateOccurrence: input => ipcRenderer.invoke(CHANNELS.events.updateOccurrence, input),
	},
	google: {
		account: () => ipcRenderer.invoke(CHANNELS.google.account),
		calendars: () => ipcRenderer.invoke(CHANNELS.google.calendars),
		connect: () => ipcRenderer.invoke(CHANNELS.google.connect),
		disconnect: () => ipcRenderer.invoke(CHANNELS.google.disconnect),
		onSyncStatus: listener => {
			syncStatusListeners.add(listener);
			return () => {
				syncStatusListeners.delete(listener);
			};
		},
		selectCalendars: input => ipcRenderer.invoke(CHANNELS.google.selectCalendars, input),
		sync: () => ipcRenderer.invoke(CHANNELS.google.sync),
		syncStatus: () => ipcRenderer.invoke(CHANNELS.google.syncStatus),
	},
	onboarding: {
		complete: input => ipcRenderer.invoke(CHANNELS.onboarding.complete, input),
	},
	profile: {
		get: () => ipcRenderer.invoke(CHANNELS.profile.get),
		update: input => ipcRenderer.invoke(CHANNELS.profile.update, input),
	},
	settings: {
		get: () => ipcRenderer.invoke(CHANNELS.settings.get),
		save: patch => ipcRenderer.invoke(CHANNELS.settings.save, patch),
	},
	updates: {
		check: () => ipcRenderer.invoke(CHANNELS.updates.check),
		install: () => ipcRenderer.invoke(CHANNELS.updates.install),
		onStatus: listener => {
			updateStatusListeners.add(listener);
			return () => {
				updateStatusListeners.delete(listener);
			};
		},
		status: () => ipcRenderer.invoke(CHANNELS.updates.status),
	},
	version: process.versions.electron ?? '',
};

contextBridge.exposeInMainWorld('desktop', desktop);
