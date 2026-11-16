import { fail, type Result } from '@tempi/core';
import { CHANNELS, type Channel } from './channels';
import type { DesktopApi, TempiApi } from './desktop-api';
import { type ChannelValue, responseValueSchemas, resultSchema } from './schemas';

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Invokes a channel and validates the answer, turning every failure into a Result so callers never need try/catch. */
const call = async <C extends Channel>(channel: C, invoke: () => Promise<unknown>): Promise<Result<ChannelValue<C>>> => {
	let response: unknown;
	try {
		response = await invoke();
	} catch (error) {
		return fail('internal', 'system.unexpected', { detail: `${channel} could not be invoked: ${message(error)}` });
	}
	const parsed = resultSchema(responseValueSchemas[channel]).safeParse(response);
	if (!parsed.success) return fail('internal', 'system.unexpected', { detail: `${channel} returned a malformed response` });
	// TS loses the channel → schema correlation through the generic index; the schema above was picked by the same `channel`.
	return parsed.data as Result<ChannelValue<C>>;
};

/** Renderer client: the app's use cases over `window.desktop`. */
export const createIpcClient = (api: DesktopApi): TempiApi => ({
	calendars: {
		create: input => call(CHANNELS.calendars.create, () => api.calendars.create(input)),
		delete: id => call(CHANNELS.calendars.delete, () => api.calendars.delete(id)),
		list: () => call(CHANNELS.calendars.list, () => api.calendars.list()),
		update: input => call(CHANNELS.calendars.update, () => api.calendars.update(input)),
	},
	events: {
		create: input => call(CHANNELS.events.create, () => api.events.create(input)),
		delete: id => call(CHANNELS.events.delete, () => api.events.delete(id)),
		list: range => call(CHANNELS.events.list, () => api.events.list(range)),
		update: input => call(CHANNELS.events.update, () => api.events.update(input)),
	},
	profile: {
		get: () => call(CHANNELS.profile.get, () => api.profile.get()),
		save: input => call(CHANNELS.profile.save, () => api.profile.save(input)),
	},
	settings: {
		get: () => call(CHANNELS.settings.get, () => api.settings.get()),
		save: patch => call(CHANNELS.settings.save, () => api.settings.save(patch)),
	},
});
