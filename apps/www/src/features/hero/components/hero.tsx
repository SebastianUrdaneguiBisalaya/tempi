import { getDictionary } from '@/app/[lang]/dictionaries';
import { HeroContent } from './hero-content';

export async function Hero() {
	const { hero } = await getDictionary();
	return <HeroContent copy={hero} />;
}
