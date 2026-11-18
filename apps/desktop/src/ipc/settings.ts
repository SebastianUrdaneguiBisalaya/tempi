import { type CoreDeps, getSettings, ok, type Settings, saveSettings, type Theme } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle, handleRequest } from './handle';

export const registerSettingsHandlers = (context: HandlerContext, deps: CoreDeps, onSaved?: (settings: Settings) => void, onThemePreviewed?: (theme: Theme | null) => void): void => {
	handle(context, CHANNELS.settings.get, async () => ok(await getSettings(deps)));
	// Nothing is stored: the preview only changes how the app looks until it's saved or dropped.
	handleRequest(context, CHANNELS.settings.previewTheme, theme => {
		onThemePreviewed?.(theme);
		return Promise.resolve(ok(null));
	});
	handle(context, CHANNELS.settings.save, patch => saveSettings(deps, patch), onSaved);
};
