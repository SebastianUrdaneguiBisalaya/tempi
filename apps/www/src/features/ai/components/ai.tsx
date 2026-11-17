import { getDictionary } from '@/app/[lang]/dictionaries';
import { AiContent } from './ai-content';

export async function Ai() {
	const { ai } = await getDictionary();
	return <AiContent copy={ai} />;
}
