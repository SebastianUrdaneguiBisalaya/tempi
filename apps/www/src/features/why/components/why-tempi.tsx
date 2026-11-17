import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { WhyContent } from './why-content';

export async function WhyTempi() {
	const [locale, { why }] = await Promise.all([getLocale(), getDictionary()]);
	return <WhyContent locale={locale} copy={why} />;
}
