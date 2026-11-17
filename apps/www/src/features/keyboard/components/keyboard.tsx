import { getDictionary } from '@/app/[lang]/dictionaries';
import { KeyboardContent } from './keyboard-content';

export async function Keyboard() {
	const { keyboard } = await getDictionary();
	return <KeyboardContent copy={keyboard} />;
}
