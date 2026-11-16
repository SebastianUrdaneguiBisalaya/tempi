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

const desktop: DesktopApi = {
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
	settings: {
		get: () => ipcRenderer.invoke(CHANNELS.settings.get),
		save: patch => ipcRenderer.invoke(CHANNELS.settings.save, patch),
	},
	version: process.versions.electron ?? '',
};

contextBridge.exposeInMainWorld('desktop', desktop);
