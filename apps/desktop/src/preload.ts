// Bundled to CommonJS (dist/preload.cjs) on purpose: sandboxed preloads cannot be ES modules or require local files.
import { CHANNELS, type DesktopApi, PUSH_CHANNELS } from '@tempi/ipc';
import { contextBridge, ipcRenderer } from 'electron';

// Only small, typed functions, one per use case: never `ipcRenderer`, a generic invoke or any Node API.
// Payloads are validated in the main process and answers in the renderer client, so nothing here is trusted.
// A clicked reminder can arrive before the page has subscribed (e.g. the window was reopened for it), so keep the
// latest one until a listener takes it.
type ReminderListener = (target: unknown) => void;
const reminderListeners = new Set<ReminderListener>();
let pendingReminder: { target: unknown } | null = null;
ipcRenderer.on(PUSH_CHANNELS.reminders.open, (_event, target: unknown) => {
	if (reminderListeners.size === 0) pendingReminder = { target };
	for (const listener of reminderListeners) listener(target);
});

const desktop: DesktopApi = {
	calendars: {
		create: input => ipcRenderer.invoke(CHANNELS.calendars.create, input),
		delete: input => ipcRenderer.invoke(CHANNELS.calendars.delete, input),
		list: () => ipcRenderer.invoke(CHANNELS.calendars.list),
		update: input => ipcRenderer.invoke(CHANNELS.calendars.update, input),
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
	onboarding: {
		complete: input => ipcRenderer.invoke(CHANNELS.onboarding.complete, input),
	},
	profile: {
		get: () => ipcRenderer.invoke(CHANNELS.profile.get),
		update: input => ipcRenderer.invoke(CHANNELS.profile.update, input),
	},
	reminders: {
		onOpen: listener => {
			reminderListeners.add(listener);
			if (pendingReminder !== null) {
				listener(pendingReminder.target);
				pendingReminder = null;
			}
			return () => {
				reminderListeners.delete(listener);
			};
		},
	},
	settings: {
		get: () => ipcRenderer.invoke(CHANNELS.settings.get),
		save: patch => ipcRenderer.invoke(CHANNELS.settings.save, patch),
	},
	version: process.versions.electron ?? '',
};

contextBridge.exposeInMainWorld('desktop', desktop);
