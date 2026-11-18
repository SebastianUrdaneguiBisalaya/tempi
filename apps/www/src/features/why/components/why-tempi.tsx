import { getDictionary } from '@/app/[lang]/dictionaries';
import { WhyContent } from './why-content';

export async function WhyTempi() {
	const { why } = await getDictionary();
	return <WhyContent copy={why} />;
}
