'use client';

import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useApi } from '@/providers/api-provider';
import { useAppearancePreview } from '@/providers/appearance-preview-provider';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Live OS preference. Inside Electron it also reflects `nativeTheme.themeSource`, which main keeps in sync with settings.
const subscribeToSystemTheme = (onChange: () => void) => {
	const query = window.matchMedia(DARK_QUERY);
	query.addEventListener('change', onChange);
	return () => query.removeEventListener('change', onChange);
};
const getSystemDark = () => window.matchMedia(DARK_QUERY).matches;
const getServerDark = () => false;

/** Applies the previewed or selected theme (dark, light, or system following the OS live) as the `dark` class on `<html>`. */
export function ThemeProvider({ children }: { children: ReactNode }) {
	const { data: settings } = useSettings();
	const api = useApi();
	const { preview } = useAppearancePreview();
	const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemDark, getServerDark);
	const theme = preview.theme ?? settings?.theme ?? 'system';
	const dark = theme === 'system' ? systemDark : theme === 'dark';

	// Main follows the saved theme in `themeSource`, which also drives `prefers-color-scheme` here. Without telling it
	// about the preview, previewing "system" after saving "light" would read light instead of the OS theme.
	const previewed = useRef(false);
	useEffect(() => {
		if (api === null || (preview.theme === undefined && !previewed.current)) return;
		previewed.current = preview.theme !== undefined;
		void api.settings.previewTheme(preview.theme ?? null).then(result => {
			if (!result.ok)
				console.error(
					'Failed to preview the theme',
					result.error.issues.map(issue => issue.detail)
				);
		});
	}, [api, preview.theme]);

	useEffect(() => {
		const root = document.documentElement;
		root.classList.toggle('dark', dark);
		// Marks the theme as resolved either way, which ends the pre-hydration fallback in globals.css.
		root.classList.toggle('light', !dark);
		// Native form controls and scrollbars follow the theme too.
		root.style.colorScheme = dark ? 'dark' : 'light';
	}, [dark]);

	return children;
}
