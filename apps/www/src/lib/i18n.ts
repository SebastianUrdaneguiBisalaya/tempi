// Kept apart from `dictionaries.ts` so the proxy can read the locales without importing `next/root-params`.
export const locales = ['en', 'es'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const hasLocale = (locale: string): locale is Locale => locales.some(supported => supported === locale);
