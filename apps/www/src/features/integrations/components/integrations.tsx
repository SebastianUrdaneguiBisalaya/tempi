import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { IntegrationsContent } from './integrations-content';

export async function Integrations() {
	const [locale, { integrations, why }] = await Promise.all([getLocale(), getDictionary()]);
	return <IntegrationsContent locale={locale} copy={integrations} events={why.mockup.events} />;
}
