'use client';

import { type Language, resolveLanguage } from '@tempi/core';
import { DEFAULT_NAMESPACE, FALLBACK_LANGUAGE, NAMESPACES, resources } from '@tempi/i18n';
import i18next from 'i18next';
import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { useSettings } from './settings-provider';

const i18n = i18next.createInstance();

// Resources are bundled, so init synchronously and render translated text on the first paint.
// It starts in the fallback language so the prerendered HTML and the first client render match; the effect below switches it.
void i18n.use(initReactI18next).init({
	defaultNS: DEFAULT_NAMESPACE,
	fallbackLng: FALLBACK_LANGUAGE,
	initAsync: false,
	interpolation: { escapeValue: false }, // React already escapes output.
	lng: FALLBACK_LANGUAGE,
	ns: [...NAMESPACES],
	resources,
});

const subscribeToSystemLanguage = (onChange: () => void) => {
	window.addEventListener('languagechange', onChange);
	return () => window.removeEventListener('languagechange', onChange);
};
const getSystemLanguage = (): Language => resolveLanguage(navigator.languages);
const getServerLanguage = (): Language => FALLBACK_LANGUAGE;

/** The language from settings; the system locale until settings load, or when there is no storage (plain browser). */
const useLanguage = (): Language => {
	const { settings } = useSettings();
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
