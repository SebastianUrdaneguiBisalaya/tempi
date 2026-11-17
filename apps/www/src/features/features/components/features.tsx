import { getDictionary } from '@/app/[lang]/dictionaries';
import { FeaturesContent } from './features-content';

export async function Features() {
	const { features } = await getDictionary();
	return <FeaturesContent copy={features} />;
}
