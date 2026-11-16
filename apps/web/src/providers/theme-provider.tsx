'use client';

import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { useSettings } from '@/features/settings/hooks/use-settings';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Live OS preference. Inside Electron it also reflects `nativeTheme.themeSource`, which main keeps in sync with settings.
const subscribeToSystemTheme = (onChange: () => void) => {
	const query = window.matchMedia(DARK_QUERY);
	query.addEventListener('change', onChange);
	return () => query.removeEventListener('change', onChange);
};
const getSystemDark = () => window.matchMedia(DARK_QUERY).matches;
const getServerDark = () => false;

/** Applies the selected theme (dark, light, or system following the OS live) as the `dark` class on `<html>`. */
export function ThemeProvider({ children }: { children: ReactNode }) {
	const { data: settings } = useSettings();
	const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemDark, getServerDark);
	const theme = settings?.theme ?? 'system';
	const dark = theme === 'system' ? systemDark : theme === 'dark';

	useEffect(() => {
		const root = document.documentElement;
		root.classList.toggle('dark', dark);
		// Native form controls and scrollbars follow the theme too.
		root.style.colorScheme = dark ? 'dark' : 'light';
	}, [dark]);

	return children;
}
