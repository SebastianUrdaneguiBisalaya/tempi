/** Every IPC channel, named `domain:action`. Each one runs a single core use case; one `ipcMain.handle` per channel. */
export const CHANNELS = {
	ai: {
		/**
		 * Starts one assistant reply. Its events don't come back in the answer: they stream over a `MessagePort` the main
		 * process sends on `PUSH_CHANNELS.ai.chatPort`, tagged with the request's id. Closing the port stops the reply.
		 */
		chat: 'ai:chat',
		/** The AI choices and which providers have a key. Keys never cross IPC towards the renderer. */
		getSettings: 'ai:getSettings',
		/** The ElevenLabs voices of the saved key's account. */
		listVoices: 'ai:listVoices',
		/** Deletes a provider's key, which disables it. */
		removeKey: 'ai:removeKey',
		/** Tests a provider's key and, only if it works, stores it encrypted in the main process. */
		saveKey: 'ai:saveKey',
		saveSettings: 'ai:saveSettings',
		/** Reads a text aloud with the saved ElevenLabs key and answers with the audio. Nothing is stored. */
		speak: 'ai:speak',
		/** Tests the saved key of a provider again. */
		testKey: 'ai:testKey',
		/** Transcribes one recorded dictation with the saved ElevenLabs key. The audio is never stored. */
		transcribe: 'ai:transcribe',
	},
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
	permissions: {
		/** Opens the OS privacy page for one permission. The main process picks the page; the renderer only names the permission. */
		openSystemSettings: 'permissions:openSystemSettings',
		/** What the OS allows for notifications and the microphone. Never prompts. */
		status: 'permissions:status',
		/** Shows one notification, which on macOS asks the user to allow them the first time. */
		testNotification: 'permissions:testNotification',
	},
	profile: {
		get: 'profile:get',
		update: 'profile:update',
	},
	settings: {
		get: 'settings:get',
		/** Shows an unsaved theme in native UI and the renderer's `prefers-color-scheme`; null goes back to the saved one. */
		previewTheme: 'settings:previewTheme',
		save: 'settings:save',
	},
	updates: {
		/** Looks for a newer release now and answers with where the update stands. */
		check: 'updates:check',
		/** Quits and installs a downloaded update (Windows, Linux AppImage); Tempi reopens on the new version. */
		install: 'updates:install',
		/** Where the update stands. */
		status: 'updates:status',
	},
} as const;

/**
 * Messages the main process pushes to the renderer (`webContents.send`), outside request/response. Each carries a
 * payload the renderer validates with its schema in `pushSchemas`.
 */
export const PUSH_CHANNELS = {
	ai: {
		/** Carries the `MessagePort` an `ai:chat` reply streams on, with `{ requestId }`. */
		chatPort: 'ai:chatPort',
	},
	google: {
		/** Sync started or ended: the new status. Data may have changed, so views refresh. */
		syncStatus: 'google:syncStatusChanged',
	},
	updates: {
		/** The update status changed: a check started or ended, a download finished. */
		status: 'updates:statusChanged',
	},
	events: {
		/** Show an occurrence in the main window: a clicked reminder, or an event picked in the menu bar calendar. */
		show: 'events:show',
	},
} as const;

type ChannelGroups = typeof CHANNELS;

export type Channel = { [Domain in keyof ChannelGroups]: ChannelGroups[Domain][keyof ChannelGroups[Domain]] }[keyof ChannelGroups];
