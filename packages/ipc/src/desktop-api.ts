import type { AppUpdateStatus, AssistantStreamEvent, GoogleSyncStatus, Result } from '@tempi/core';
import type { Channel } from './channels';
import type { ChannelInput, ChannelValue, OccurrenceRef } from './schemas';

// `Raw` answers are what crosses the bridge, still unvalidated; checked answers are parsed `Result`s.
type Answer<C extends Channel, Raw extends boolean> = Raw extends true ? unknown : Result<ChannelValue<C>>;
type Call<C extends Channel, Raw extends boolean> = (input: ChannelInput<C>) => Promise<Answer<C, Raw>>;
type CallWithoutInput<C extends Channel, Raw extends boolean> = () => Promise<Answer<C, Raw>>;

type Api<Raw extends boolean> = {
	ai: {
		/**
		 * Starts an assistant reply; `listener` receives its events until `done` or `error`. Call `stopChat` with the same
		 * `requestId` to stop it early or once it ended, which closes its stream.
		 */
		chat: (input: ChannelInput<'ai:chat'>, listener: (event: Raw extends true ? unknown : AssistantStreamEvent) => void) => Promise<Answer<'ai:chat', Raw>>;
		stopChat: (requestId: string) => void;
		getSettings: CallWithoutInput<'ai:getSettings', Raw>;
		listVoices: CallWithoutInput<'ai:listVoices', Raw>;
		removeKey: Call<'ai:removeKey', Raw>;
		saveKey: Call<'ai:saveKey', Raw>;
		saveSettings: Call<'ai:saveSettings', Raw>;
		speak: Call<'ai:speak', Raw>;
		testKey: Call<'ai:testKey', Raw>;
		transcribe: Call<'ai:transcribe', Raw>;
	};
	app: {
		showEvent: Call<'app:showEvent', Raw>;
		/** Calls `listener` each time the main process asks this window to show an occurrence; returns the unsubscribe function. */
		onShowEvent: (listener: (ref: Raw extends true ? unknown : OccurrenceRef) => void) => () => void;
	};
	calendars: {
		create: Call<'calendars:create', Raw>;
		delete: Call<'calendars:delete', Raw>;
		export: Call<'calendars:export', Raw>;
		import: Call<'calendars:import', Raw>;
		list: CallWithoutInput<'calendars:list', Raw>;
		update: Call<'calendars:update', Raw>;
	};
	data: {
		backup: CallWithoutInput<'data:backup', Raw>;
		restore: CallWithoutInput<'data:restore', Raw>;
	};
	events: {
		create: Call<'events:create', Raw>;
		delete: Call<'events:delete', Raw>;
		deleteOccurrence: Call<'events:deleteOccurrence', Raw>;
		duplicate: Call<'events:duplicate', Raw>;
		list: Call<'events:list', Raw>;
		restore: Call<'events:restore', Raw>;
		search: Call<'events:search', Raw>;
		update: Call<'events:update', Raw>;
		updateOccurrence: Call<'events:updateOccurrence', Raw>;
	};
	google: {
		account: CallWithoutInput<'google:account', Raw>;
		calendars: CallWithoutInput<'google:calendars', Raw>;
		connect: CallWithoutInput<'google:connect', Raw>;
		disconnect: CallWithoutInput<'google:disconnect', Raw>;
		selectCalendars: Call<'google:selectCalendars', Raw>;
		sync: CallWithoutInput<'google:sync', Raw>;
		syncStatus: CallWithoutInput<'google:syncStatus', Raw>;
		/** Calls `listener` with each new sync status the main process pushes; returns the unsubscribe function. */
		onSyncStatus: (listener: (status: Raw extends true ? unknown : GoogleSyncStatus) => void) => () => void;
	};
	onboarding: {
		complete: Call<'onboarding:complete', Raw>;
	};
	permissions: {
		openSystemSettings: Call<'permissions:openSystemSettings', Raw>;
		status: CallWithoutInput<'permissions:status', Raw>;
		testNotification: CallWithoutInput<'permissions:testNotification', Raw>;
	};
	profile: {
		get: CallWithoutInput<'profile:get', Raw>;
		update: Call<'profile:update', Raw>;
	};
	settings: {
		get: CallWithoutInput<'settings:get', Raw>;
		previewTheme: Call<'settings:previewTheme', Raw>;
		save: Call<'settings:save', Raw>;
	};
	updates: {
		check: CallWithoutInput<'updates:check', Raw>;
		install: CallWithoutInput<'updates:install', Raw>;
		status: CallWithoutInput<'updates:status', Raw>;
		/** Calls `listener` with each new update status the main process pushes; returns the unsubscribe function. */
		onStatus: (listener: (status: Raw extends true ? unknown : AppUpdateStatus) => void) => () => void;
	};
};

/**
 * The app's use cases, independent of transport. Every call resolves to a `Result` and never rejects.
 * Each call runs as one unit: it either completes or changes nothing.
 */
export type TempiApi = Api<false>;

/** The bridge the preload exposes as `window.desktop`. Its answers are unvalidated; use it through `createIpcClient`. */
export type DesktopApi = Api<true> & {
	/** Electron version, for diagnostics. */
	version: string;
};

declare global {
	interface Window {
		/** Present only inside the desktop app; feature-detect it, never assume it. */
		desktop?: DesktopApi;
	}
}
