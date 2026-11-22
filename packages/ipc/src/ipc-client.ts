import { appUpdateStatusSchema, assistantStreamEventSchema, fail, googleSyncStatusSchema, type Result } from '@tempi/core';
import { CHANNELS, type Channel, PUSH_CHANNELS } from './channels';
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
	ai: {
		chat: (input, listener) =>
			call(CHANNELS.ai.chat, () =>
				api.ai.chat(input, payload => {
					// A malformed event ends the reply as a failure, so the UI never waits on a stream it can't read.
					const parsed = assistantStreamEventSchema.safeParse(payload);
					if (parsed.success) listener(parsed.data);
					else listener({ error: { code: 'internal', issues: [{ detail: 'ai:chat streamed a malformed event', key: 'system.unexpected' }] }, type: 'error' });
				})
			),
		getSettings: () => call(CHANNELS.ai.getSettings, () => api.ai.getSettings()),
		listVoices: () => call(CHANNELS.ai.listVoices, () => api.ai.listVoices()),
		quickAdd: input => call(CHANNELS.ai.quickAdd, () => api.ai.quickAdd(input)),
		removeKey: provider => call(CHANNELS.ai.removeKey, () => api.ai.removeKey(provider)),
		stopChat: requestId => api.ai.stopChat(requestId),
		saveKey: input => call(CHANNELS.ai.saveKey, () => api.ai.saveKey(input)),
		saveSettings: patch => call(CHANNELS.ai.saveSettings, () => api.ai.saveSettings(patch)),
		speak: input => call(CHANNELS.ai.speak, () => api.ai.speak(input)),
		testKey: provider => call(CHANNELS.ai.testKey, () => api.ai.testKey(provider)),
		transcribe: input => call(CHANNELS.ai.transcribe, () => api.ai.transcribe(input)),
	},
	app: {
		copyText: text => call(CHANNELS.app.copyText, () => api.app.copyText(text)),
		// Pushed payloads are as untrusted as answers: a malformed one is logged and dropped.
		onShowEvent: listener =>
			api.app.onShowEvent(payload => {
				const parsed = occurrenceRefSchema.safeParse(payload);
				if (parsed.success) listener(parsed.data);
				else console.error('events:show sent a malformed payload');
			}),
		showEvent: ref => call(CHANNELS.app.showEvent, () => api.app.showEvent(ref)),
	},
	availability: {
		freeSlots: query => call(CHANNELS.availability.freeSlots, () => api.availability.freeSlots(query)),
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
		calendars: () => call(CHANNELS.google.calendars, () => api.google.calendars()),
		connect: () => call(CHANNELS.google.connect, () => api.google.connect()),
		disconnect: () => call(CHANNELS.google.disconnect, () => api.google.disconnect()),
		onSyncStatus: listener =>
			api.google.onSyncStatus(payload => {
				const parsed = googleSyncStatusSchema.safeParse(payload);
				if (parsed.success) listener(parsed.data);
				else console.error(`${PUSH_CHANNELS.google.syncStatus} sent a malformed payload`);
			}),
		selectCalendars: input => call(CHANNELS.google.selectCalendars, () => api.google.selectCalendars(input)),
		sync: () => call(CHANNELS.google.sync, () => api.google.sync()),
		syncStatus: () => call(CHANNELS.google.syncStatus, () => api.google.syncStatus()),
	},
	holidays: {
		sync: () => call(CHANNELS.holidays.sync, () => api.holidays.sync()),
	},
	onboarding: {
		complete: input => call(CHANNELS.onboarding.complete, () => api.onboarding.complete(input)),
	},
	permissions: {
		openSystemSettings: permission => call(CHANNELS.permissions.openSystemSettings, () => api.permissions.openSystemSettings(permission)),
		status: () => call(CHANNELS.permissions.status, () => api.permissions.status()),
		testNotification: () => call(CHANNELS.permissions.testNotification, () => api.permissions.testNotification()),
	},
	profile: {
		get: () => call(CHANNELS.profile.get, () => api.profile.get()),
		update: input => call(CHANNELS.profile.update, () => api.profile.update(input)),
	},
	settings: {
		get: () => call(CHANNELS.settings.get, () => api.settings.get()),
		previewTheme: theme => call(CHANNELS.settings.previewTheme, () => api.settings.previewTheme(theme)),
		save: patch => call(CHANNELS.settings.save, () => api.settings.save(patch)),
	},
	stats: {
		time: query => call(CHANNELS.stats.time, () => api.stats.time(query)),
	},
	updates: {
		check: () => call(CHANNELS.updates.check, () => api.updates.check()),
		install: () => call(CHANNELS.updates.install, () => api.updates.install()),
		onStatus: listener =>
			api.updates.onStatus(payload => {
				const parsed = appUpdateStatusSchema.safeParse(payload);
				if (parsed.success) listener(parsed.data);
				else console.error(`${PUSH_CHANNELS.updates.status} sent a malformed payload`);
			}),
		status: () => call(CHANNELS.updates.status, () => api.updates.status()),
	},
	weather: {
		current: () => call(CHANNELS.weather.current, () => api.weather.current()),
		searchLocations: query => call(CHANNELS.weather.searchLocations, () => api.weather.searchLocations(query)),
	},
});
