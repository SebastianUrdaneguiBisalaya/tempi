// Bundled to CommonJS (dist/preload.cjs) on purpose: sandboxed preloads cannot be ES modules or require local files.
import { CHANNELS, type DesktopApi } from '@tempi/ipc';
import { contextBridge, ipcRenderer } from 'electron';

// Only small, typed functions, one per use case: never `ipcRenderer`, a generic invoke or any Node API.
// Payloads are validated in the main process and answers in the renderer client, so nothing here is trusted.
const desktop: DesktopApi = {
	calendars: {
		create: input => ipcRenderer.invoke(CHANNELS.calendars.create, input),
		delete: id => ipcRenderer.invoke(CHANNELS.calendars.delete, id),
		list: () => ipcRenderer.invoke(CHANNELS.calendars.list),
		update: input => ipcRenderer.invoke(CHANNELS.calendars.update, input),
	},
	events: {
		create: input => ipcRenderer.invoke(CHANNELS.events.create, input),
		delete: id => ipcRenderer.invoke(CHANNELS.events.delete, id),
		list: range => ipcRenderer.invoke(CHANNELS.events.list, range),
		update: input => ipcRenderer.invoke(CHANNELS.events.update, input),
	},
	profile: {
		get: () => ipcRenderer.invoke(CHANNELS.profile.get),
		save: input => ipcRenderer.invoke(CHANNELS.profile.save, input),
	},
	settings: {
		get: () => ipcRenderer.invoke(CHANNELS.settings.get),
		save: patch => ipcRenderer.invoke(CHANNELS.settings.save, patch),
	},
	version: process.versions.electron ?? '',
};

contextBridge.exposeInMainWorld('desktop', desktop);
