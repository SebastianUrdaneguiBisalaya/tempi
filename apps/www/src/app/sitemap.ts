import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n';
import { LEGAL_PAGES, SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
	const entries = (path: string, priority: number): MetadataRoute.Sitemap => {
		const languages = Object.fromEntries(locales.map(locale => [locale, `${SITE_URL}/${locale}${path}`]));
		return locales.map(locale => ({ url: `${SITE_URL}/${locale}${path}`, changeFrequency: 'monthly', priority, alternates: { languages } }));
	};
	return [...entries('', 1), ...LEGAL_PAGES.flatMap(page => entries(`/${page}`, 0.3))];
}
