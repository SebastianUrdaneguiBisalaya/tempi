import type { Result } from '@tempi/core';
import type { Channel } from './channels';
import type { ChannelInput, ChannelValue } from './schemas';

// `Raw` answers are what crosses the bridge, still unvalidated; checked answers are parsed `Result`s.
type Answer<C extends Channel, Raw extends boolean> = Raw extends true ? unknown : Result<ChannelValue<C>>;
type Call<C extends Channel, Raw extends boolean> = (input: ChannelInput<C>) => Promise<Answer<C, Raw>>;
type CallWithoutInput<C extends Channel, Raw extends boolean> = () => Promise<Answer<C, Raw>>;

type Api<Raw extends boolean> = {
	calendars: {
		create: Call<'calendars:create', Raw>;
		delete: Call<'calendars:delete', Raw>;
		list: CallWithoutInput<'calendars:list', Raw>;
		update: Call<'calendars:update', Raw>;
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
	onboarding: {
		complete: Call<'onboarding:complete', Raw>;
	};
	profile: {
		get: CallWithoutInput<'profile:get', Raw>;
		save: Call<'profile:save', Raw>;
	};
	settings: {
		get: CallWithoutInput<'settings:get', Raw>;
		save: Call<'settings:save', Raw>;
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
