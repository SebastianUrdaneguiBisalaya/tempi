import { notFound } from 'next/navigation';
import { lang } from 'next/root-params';
import { hasLocale, type Locale } from '@/lib/i18n';
import type en from './dictionaries/en.json';

export type Dictionary = typeof en;

// `es.json` is checked against `en.json` by dictionaries.test.ts, so the cast below can't hide a missing key.
const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
	en: () => import('./dictionaries/en.json').then(module => module.default),
	es: () => import('./dictionaries/es.json').then(module => module.default as Dictionary),
};

export async function getLocale(): Promise<Locale> {
	const locale = await lang();
	if (!hasLocale(locale)) notFound();
	return locale;
}

/** For metadata routes (Open Graph images), where root params aren't available and the locale comes from `params`. */
export const loadDictionary = (locale: Locale): Promise<Dictionary> => dictionaries[locale]();

export async function getDictionary(): Promise<Dictionary> {
	return loadDictionary(await getLocale());
}
