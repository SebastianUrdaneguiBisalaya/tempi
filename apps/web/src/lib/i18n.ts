import { DEFAULT_NAMESPACE, FALLBACK_LANGUAGE, NAMESPACES, resources } from '@tempi/i18n';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/** The app's only i18next instance: React reads it through `I18nProvider`; code outside React (query cache handlers) calls `i18n.t`. */
export const i18n = i18next.createInstance();

// Resources are bundled, so init synchronously and render translated text on the first paint.
// It starts in the fallback language so the prerendered HTML and the first client render match; `I18nProvider` switches it.
void i18n.use(initReactI18next).init({
	defaultNS: DEFAULT_NAMESPACE,
	fallbackLng: FALLBACK_LANGUAGE,
	initAsync: false,
	interpolation: { escapeValue: false }, // React already escapes output.
	lng: FALLBACK_LANGUAGE,
	ns: [...NAMESPACES],
	resources,
});
