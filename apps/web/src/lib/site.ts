import { type Language, resolveLanguage } from '@tempi/core';

// Next inlines both at build time. The landing's `next dev` runs on port 3001, so a dev build links there.
const DEFAULT_WEBSITE_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://tempi.sebastianurdanegui.com';

/** Tempi's website (`NEXT_PUBLIC_WEBSITE_URL` overrides it); the main process opens links to it in the system browser. */
export const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? DEFAULT_WEBSITE_URL;

/** A legal page of the website, under the locale prefix of the app's language (`i18n.language`). */
export const legalPageUrl = (page: 'privacy' | 'terms', language: string): string => {
	const locale: Language = resolveLanguage([language]);
	return `${WEBSITE_URL}/${locale}/${page}`;
};
