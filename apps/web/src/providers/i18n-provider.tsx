'use client';

import { DEFAULT_NAMESPACE, FALLBACK_LANGUAGE, NAMESPACES, resources } from '@tempi/i18n';
import i18next from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';

const i18n = i18next.createInstance();

// Resources are bundled, so init synchronously and render translated text on the first paint.
// The user's language from settings is applied with `i18n.changeLanguage` once settings are wired in.
void i18n.use(initReactI18next).init({
	defaultNS: DEFAULT_NAMESPACE,
	fallbackLng: FALLBACK_LANGUAGE,
	initAsync: false,
	interpolation: { escapeValue: false }, // React already escapes output.
	lng: FALLBACK_LANGUAGE,
	ns: [...NAMESPACES],
	resources,
});

export function I18nProvider({ children }: { children: ReactNode }) {
	return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
