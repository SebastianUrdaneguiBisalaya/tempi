import { fail, type Result } from '@tempi/core';
import { CHANNELS, type Channel } from './channels';
import type { DesktopApi, TempiApi } from './desktop-api';
import { type ChannelValue, occurrenceRefSchema, responseValueSchemas, resultSchema } from './schemas';

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
	app: {
		// Pushed payloads are as untrusted as answers: a malformed one is logged and dropped.
		onShowEvent: listener =>
			api.app.onShowEvent(payload => {
				const parsed = occurrenceRefSchema.safeParse(payload);
				if (parsed.success) listener(parsed.data);
				else console.error('events:show sent a malformed payload');
			}),
		showEvent: ref => call(CHANNELS.app.showEvent, () => api.app.showEvent(ref)),
	},
	calendars: {
		create: input => call(CHANNELS.calendars.create, () => api.calendars.create(input)),
		delete: input => call(CHANNELS.calendars.delete, () => api.calendars.delete(input)),
		export: input => call(CHANNELS.calendars.export, () => api.calendars.export(input)),
		import: input => call(CHANNELS.calendars.import, () => api.calendars.import(input)),
		list: () => call(CHANNELS.calendars.list, () => api.calendars.list()),
		update: input => call(CHANNELS.calendars.update, () => api.calendars.update(input)),
	},
	data: {
		backup: () => call(CHANNELS.data.backup, () => api.data.backup()),
		restore: () => call(CHANNELS.data.restore, () => api.data.restore()),
	},
	events: {
		create: input => call(CHANNELS.events.create, () => api.events.create(input)),
		delete: id => call(CHANNELS.events.delete, () => api.events.delete(id)),
		deleteOccurrence: input => call(CHANNELS.events.deleteOccurrence, () => api.events.deleteOccurrence(input)),
		duplicate: id => call(CHANNELS.events.duplicate, () => api.events.duplicate(id)),
		list: range => call(CHANNELS.events.list, () => api.events.list(range)),
		restore: id => call(CHANNELS.events.restore, () => api.events.restore(id)),
		search: query => call(CHANNELS.events.search, () => api.events.search(query)),
		update: input => call(CHANNELS.events.update, () => api.events.update(input)),
		updateOccurrence: input => call(CHANNELS.events.updateOccurrence, () => api.events.updateOccurrence(input)),
	},
	google: {
		account: () => call(CHANNELS.google.account, () => api.google.account()),
		connect: () => call(CHANNELS.google.connect, () => api.google.connect()),
		disconnect: () => call(CHANNELS.google.disconnect, () => api.google.disconnect()),
	},
	onboarding: {
		complete: input => call(CHANNELS.onboarding.complete, () => api.onboarding.complete(input)),
	},
	profile: {
		get: () => call(CHANNELS.profile.get, () => api.profile.get()),
		update: input => call(CHANNELS.profile.update, () => api.profile.update(input)),
	},
	settings: {
		get: () => call(CHANNELS.settings.get, () => api.settings.get()),
		save: patch => call(CHANNELS.settings.save, () => api.settings.save(patch)),
	},
});
