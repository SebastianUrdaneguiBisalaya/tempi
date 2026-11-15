import type { Settings } from '../domain/settings';

export type SettingsRepository = {
	/** Null until settings are saved for the first time. */
	get(): Promise<Settings | null>;
	save(settings: Settings): Promise<void>;
};
