/** Every IPC channel, named `domain:action`. One `ipcMain.handle` per channel. */
export const CHANNELS = {
	calendars: {
		get: 'calendars:get',
		list: 'calendars:list',
		save: 'calendars:save',
	},
	events: {
		deleteByCalendar: 'events:deleteByCalendar',
		get: 'events:get',
		list: 'events:list',
		save: 'events:save',
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
