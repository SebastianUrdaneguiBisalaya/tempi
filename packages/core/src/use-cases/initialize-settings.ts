import { ok, type Result } from '../domain/result';
import { resolveLanguage, type Settings } from '../domain/settings';
import type { CoreDeps } from './deps';
import { saveSettings } from './save-settings';

/**
 * First-run setup: before anything is saved, persists the defaults with the language picked from the system locales
 * (in preference order). Afterwards the stored settings win and the locales are ignored.
 */
export const initializeSettings = async (deps: Pick<CoreDeps, 'clock' | 'settings'>, systemLocales: readonly string[]): Promise<Result<Settings>> => {
	const stored = await deps.settings.get();
	if (stored !== null) return ok(stored);
	return saveSettings(deps, { language: resolveLanguage(systemLocales) });
};
