import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { type CoreDeps, nowIso } from './deps';

/** Stored settings, or the defaults (not persisted) before the first save. */
export const getSettings = async (deps: Pick<CoreDeps, 'clock' | 'settings'>): Promise<Settings> => {
	const stored = await deps.settings.get();
	if (stored !== null) return stored;
	const now = nowIso(deps.clock);
	return { ...DEFAULT_SETTINGS, createdAt: now, updatedAt: now };
};
