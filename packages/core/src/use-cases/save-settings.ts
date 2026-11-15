import { ok, type Result } from '../domain/result';
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch, validateSettingsValues } from '../domain/settings';
import { type CoreDeps, nowIso } from './deps';

/** Merges the patch over the stored settings (or the defaults) and saves the result. */
export const saveSettings = async (deps: Pick<CoreDeps, 'clock' | 'settings'>, patch: SettingsPatch): Promise<Result<Settings>> => {
	const current = await deps.settings.get();
	const { createdAt, updatedAt: _updatedAt, ...currentValues } = current ?? { ...DEFAULT_SETTINGS, createdAt: null, updatedAt: null };
	const values = validateSettingsValues({ ...currentValues, ...patch });
	if (!values.ok) return values;

	const now = nowIso(deps.clock);
	const settings: Settings = { ...values.value, createdAt: createdAt ?? now, updatedAt: now };
	await deps.settings.save(settings);
	return ok(settings);
};
