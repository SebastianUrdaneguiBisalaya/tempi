'use client';

import { type Language, resolveLanguage } from '@tempi/core';
import { FALLBACK_LANGUAGE } from '@tempi/i18n';
import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { I18nextProvider } from 'react-i18next';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { i18n } from '@/lib/i18n';

const subscribeToSystemLanguage = (onChange: () => void) => {
	window.addEventListener('languagechange', onChange);
	return () => window.removeEventListener('languagechange', onChange);
};
const getSystemLanguage = (): Language => resolveLanguage(navigator.languages);
const getServerLanguage = (): Language => FALLBACK_LANGUAGE;

/** The language from settings; the system locale until settings load, or when there is no storage (plain browser). */
const useLanguage = (): Language => {
	const { data: settings } = useSettings();
	const systemLanguage = useSyncExternalStore(subscribeToSystemLanguage, getSystemLanguage, getServerLanguage);
	return settings?.language ?? systemLanguage;
};

export function I18nProvider({ children }: { children: ReactNode }) {
	const language = useLanguage();

	useEffect(() => {
		void i18n.changeLanguage(language);
		document.documentElement.lang = language;
	}, [language]);

	return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
