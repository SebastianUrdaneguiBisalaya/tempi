import { type CoreDeps, getSettings, ok, type Settings, saveSettings } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerSettingsHandlers = (context: HandlerContext, deps: CoreDeps, onSaved?: (settings: Settings) => void): void => {
	handle(context, CHANNELS.settings.get, async () => ok(await getSettings(deps)));
	handle(context, CHANNELS.settings.save, patch => saveSettings(deps, patch), onSaved);
};
