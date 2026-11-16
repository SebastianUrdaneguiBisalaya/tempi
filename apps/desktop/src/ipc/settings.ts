import type { SettingsRepository } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerSettingsHandlers = (context: HandlerContext, settings: SettingsRepository): void => {
	handle(context, CHANNELS.settings.get, () => settings.get());
	handle(context, CHANNELS.settings.save, async value => {
		await settings.save(value);
		return null;
	});
};
