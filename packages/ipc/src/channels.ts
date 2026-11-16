/** Every IPC channel, named `domain:action`. Each one runs a single core use case; one `ipcMain.handle` per channel. */
export const CHANNELS = {
	app: {
		/** Brings the main window forward on an occurrence, e.g. one picked in the menu bar calendar. */
		showEvent: 'app:showEvent',
	},
	calendars: {
		create: 'calendars:create',
		delete: 'calendars:delete',
		/** Asks for a file to save, then writes one calendar (or all) as `.ics`. */
		export: 'calendars:export',
		/** Asks for an `.ics` file, then adds its events to a calendar. */
		import: 'calendars:import',
		list: 'calendars:list',
		update: 'calendars:update',
	},
	data: {
		/** Asks where to save, then writes a backup of the whole database. */
		backup: 'data:backup',
		/** Asks for a backup, replaces every piece of data with it, then relaunches the app. */
		restore: 'data:restore',
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
	google: {
		/** The connected Google account, or null. */
		account: 'google:account',
		/** The connected account's calendars, as the last sync listed them, to pick which ones sync. */
		calendars: 'google:calendars',
		/** Signs in with Google in the system browser and keeps the tokens, encrypted, in the main process. */
		connect: 'google:connect',
		/** Revokes the tokens at Google and deletes them. */
		disconnect: 'google:disconnect',
		/** Chooses which Google calendars sync; unselected ones leave Tempi. */
		selectCalendars: 'google:selectCalendars',
		/** Syncs now and answers with the outcome. */
		sync: 'google:sync',
		/** Where sync stands. */
		syncStatus: 'google:syncStatus',
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
	google: {
		/** Sync started or ended: the new status. Data may have changed, so views refresh. */
		syncStatus: 'google:syncStatusChanged',
	},
	events: {
		/** Show an occurrence in the main window: a clicked reminder, or an event picked in the menu bar calendar. */
		show: 'events:show',
	},
} as const;

type ChannelGroups = typeof CHANNELS;

export type Channel = { [Domain in keyof ChannelGroups]: ChannelGroups[Domain][keyof ChannelGroups[Domain]] }[keyof ChannelGroups];
