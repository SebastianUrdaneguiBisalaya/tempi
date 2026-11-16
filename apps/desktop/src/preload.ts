// Bundled to CommonJS (dist/preload.cjs) on purpose: sandboxed preloads cannot be ES modules or require local files.
import { CHANNELS, type DesktopApi } from '@tempi/ipc';
import { contextBridge, ipcRenderer } from 'electron';

// Only small, typed functions, one per channel: never `ipcRenderer`, a generic invoke or any Node API.
// Payloads are validated in the main process, so nothing here is trusted.
const desktop: DesktopApi = {
	calendars: {
		get: id => ipcRenderer.invoke(CHANNELS.calendars.get, id),
		list: () => ipcRenderer.invoke(CHANNELS.calendars.list),
		save: calendar => ipcRenderer.invoke(CHANNELS.calendars.save, calendar),
	},
	events: {
		deleteByCalendar: payload => ipcRenderer.invoke(CHANNELS.events.deleteByCalendar, payload),
		get: id => ipcRenderer.invoke(CHANNELS.events.get, id),
		list: range => ipcRenderer.invoke(CHANNELS.events.list, range),
		save: event => ipcRenderer.invoke(CHANNELS.events.save, event),
	},
	profile: {
		get: () => ipcRenderer.invoke(CHANNELS.profile.get),
		save: profile => ipcRenderer.invoke(CHANNELS.profile.save, profile),
	},
	settings: {
		get: () => ipcRenderer.invoke(CHANNELS.settings.get),
		save: settings => ipcRenderer.invoke(CHANNELS.settings.save, settings),
	},
	version: process.versions.electron ?? '',
};

contextBridge.exposeInMainWorld('desktop', desktop);
