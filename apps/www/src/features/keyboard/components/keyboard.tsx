import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { KeyboardContent } from './keyboard-content';

export async function Keyboard() {
	const [locale, { keyboard, why }] = await Promise.all([getLocale(), getDictionary()]);
	return <KeyboardContent locale={locale} copy={keyboard} mockup={why.mockup} />;
}
