import { getDictionary } from '@/app/[lang]/dictionaries';
import { FaqContent } from './faq-content';

export async function Faq() {
	const { faq } = await getDictionary();
	return <FaqContent copy={faq} />;
}
