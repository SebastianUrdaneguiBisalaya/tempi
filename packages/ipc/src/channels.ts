/** Every IPC channel, named `domain:action`. Each one runs a single core use case; one `ipcMain.handle` per channel. */
export const CHANNELS = {
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
		list: 'events:list',
		restore: 'events:restore',
		update: 'events:update',
		updateOccurrence: 'events:updateOccurrence',
	},
	onboarding: {
		complete: 'onboarding:complete',
	},
	profile: {
		get: 'profile:get',
		save: 'profile:save',
	},
	settings: {
		get: 'settings:get',
		save: 'settings:save',
	},
} as const;

type ChannelGroups = typeof CHANNELS;

export type Channel = { [Domain in keyof ChannelGroups]: ChannelGroups[Domain][keyof ChannelGroups[Domain]] }[keyof ChannelGroups];
