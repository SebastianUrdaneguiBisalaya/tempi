import { ok, parseWith, type Result } from '../domain/result';
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch, settingsPatchSchema } from '../domain/settings';
import { type CoreDeps, nowIso } from './deps';

/** Merges the patch over the stored settings (or the defaults) and saves the result. */
export const saveSettings = async (deps: Pick<CoreDeps, 'clock' | 'settings'>, patch: SettingsPatch): Promise<Result<Settings>> => {
	const changes = parseWith(settingsPatchSchema, patch);
	if (!changes.ok) return changes;

	const current = await deps.settings.get();
	const now = nowIso(deps.clock);
	const settings: Settings = { ...DEFAULT_SETTINGS, ...current, ...changes.value, createdAt: current?.createdAt ?? now, updatedAt: now };
	await deps.settings.save(settings);
	return ok(settings);
};
