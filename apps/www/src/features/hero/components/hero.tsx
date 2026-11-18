import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { HeroContent } from './hero-content';

export async function Hero() {
	const [locale, { hero, why }] = await Promise.all([getLocale(), getDictionary()]);
	return <HeroContent locale={locale} copy={hero} mockup={why.mockup} />;
}
