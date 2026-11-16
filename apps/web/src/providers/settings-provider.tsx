'use client';

import { fail, type Result, type Settings, type SettingsPatch } from '@tempi/core';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { useApi } from './api-provider';

type SettingsContextValue = {
	/** Stored settings, or null while loading or when storage is unavailable (plain browser). */
	settings: Settings | null;
	/** Saves a patch and, on success, updates every consumer without a reload. */
	save: (patch: SettingsPatch) => Promise<Result<Settings>>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Loads the persisted settings once and shares them, so language and theme react to every save. */
export function SettingsProvider({ children }: { children: ReactNode }) {
	const api = useApi();
	const [settings, setSettings] = useState<Settings | null>(null);

	useEffect(() => {
		if (api === null) return;
		let active = true;
		void api.settings.get().then(result => {
			if (!active) return;
			if (result.ok) setSettings(result.value);
			else console.error('Failed to load settings', result.error);
		});
		return () => {
			active = false;
		};
	}, [api]);

	const save = async (patch: SettingsPatch): Promise<Result<Settings>> => {
		if (api === null) return fail('internal', 'system.unexpected', { detail: 'Settings storage is unavailable outside the desktop app' });
		const result = await api.settings.save(patch);
		if (result.ok) setSettings(result.value);
		return result;
	};

	return <SettingsContext value={{ save, settings }}>{children}</SettingsContext>;
}

export const useSettings = (): SettingsContextValue => {
	const context = use(SettingsContext);
	if (context === null) throw new Error('useSettings must be used inside <SettingsProvider>');
	return context;
};
