/** Every IPC channel, named `domain:action`. Each one runs a single core use case; one `ipcMain.handle` per channel. */
export const CHANNELS = {
	app: {
		/** Brings the main window forward on an occurrence, e.g. one picked in the menu bar calendar. */
		showEvent: 'app:showEvent',
	},
	calendars: {
		create: 'calendars:create',
		delete: 'calendars:delete',
		list: 'calendars:list',
		update: 'calendars:update',
	},
	events: {
		create: 'events:create',
		delete: 'events:delete',
		deleteOccurrence: 'events:deleteOccurrence',
		duplicate: 'events:duplicate',
		list: 'events:list',
		restore: 'events:restore',
		search: 'events:search',
		update: 'events:update',
		updateOccurrence: 'events:updateOccurrence',
	},
	onboarding: {
		complete: 'onboarding:complete',
	},
	profile: {
		get: 'profile:get',
		update: 'profile:update',
	},
	settings: {
		get: 'settings:get',
		save: 'settings:save',
	},
} as const;

/**
 * Messages the main process pushes to the renderer (`webContents.send`), outside request/response. Each carries a
 * payload the renderer validates with its schema in `pushSchemas`.
 */
export const PUSH_CHANNELS = {
	events: {
		/** Show an occurrence in the main window: a clicked reminder, or an event picked in the menu bar calendar. */
		show: 'events:show',
	},
} as const;

type ChannelGroups = typeof CHANNELS;

export type Channel = { [Domain in keyof ChannelGroups]: ChannelGroups[Domain][keyof ChannelGroups[Domain]] }[keyof ChannelGroups];
