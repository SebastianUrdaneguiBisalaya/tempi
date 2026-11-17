import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { HeaderBar } from './header-bar';

export async function SiteHeader() {
	const [locale, { header }] = await Promise.all([getLocale(), getDictionary()]);
	return <HeaderBar locale={locale} copy={header} />;
}
