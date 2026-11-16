import type { CoreDeps, DomainError } from '@tempi/core';
import type { Channel } from './channels';
import { CHANNELS } from './channels';
import type { DesktopApi } from './desktop-api';
import { type ChannelValue, responseValueSchemas, resultSchema } from './schemas';

/** A failed IPC result, rethrown so callers of a repository port see it as a rejection. */
export class DesktopApiError extends Error {
	readonly channel: Channel;
	readonly error: DomainError;

	constructor(channel: Channel, error: DomainError) {
		super(`${channel} failed (${error.code}): ${error.issues.map(issue => issue.detail).join('; ')}`);
		this.name = 'DesktopApiError';
		this.channel = channel;
		this.error = error;
	}
}

/** Validates what the main process answered and unwraps the value, or throws. */
const unwrap = async <C extends Channel>(channel: C, response: Promise<unknown>): Promise<ChannelValue<C>> => {
	const parsed = resultSchema(responseValueSchemas[channel]).safeParse(await response);
	if (!parsed.success) throw new Error(`${channel} returned a malformed response`);
	if (!parsed.data.ok) throw new DesktopApiError(channel, parsed.data.error);
	// TS loses the channel → schema correlation through the generic index; the schema above was picked by the same `channel`.
	return parsed.data.value as ChannelValue<C>;
};

export type IpcRepositories = Pick<CoreDeps, 'calendars' | 'events' | 'profile' | 'settings'>;

/** Renderer adapters: the core repository ports, implemented over `window.desktop`. */
export const createIpcRepositories = (api: DesktopApi): IpcRepositories => ({
	calendars: {
		findById: id => unwrap(CHANNELS.calendars.get, api.calendars.get(id)),
		list: () => unwrap(CHANNELS.calendars.list, api.calendars.list()),
		save: async calendar => {
			await unwrap(CHANNELS.calendars.save, api.calendars.save(calendar));
		},
	},
	events: {
		findById: id => unwrap(CHANNELS.events.get, api.events.get(id)),
		listInRange: range => unwrap(CHANNELS.events.list, api.events.list(range)),
		save: async event => {
			await unwrap(CHANNELS.events.save, api.events.save(event));
		},
		softDeleteByCalendar: async (calendarId, deletedAt) => {
			await unwrap(CHANNELS.events.deleteByCalendar, api.events.deleteByCalendar({ calendarId, deletedAt }));
		},
	},
	profile: {
		get: () => unwrap(CHANNELS.profile.get, api.profile.get()),
		save: async profile => {
			await unwrap(CHANNELS.profile.save, api.profile.save(profile));
		},
	},
	settings: {
		get: () => unwrap(CHANNELS.settings.get, api.settings.get()),
		save: async settings => {
			await unwrap(CHANNELS.settings.save, api.settings.save(settings));
		},
	},
});
