import { type CoreDeps, getSettings, ok, saveSettings } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerSettingsHandlers = (context: HandlerContext, deps: CoreDeps): void => {
	handle(context, CHANNELS.settings.get, async () => ok(await getSettings(deps)));
	handle(context, CHANNELS.settings.save, patch => saveSettings(deps, patch));
};
