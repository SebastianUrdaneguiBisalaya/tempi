import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { PlanningContent } from './planning-content';

export async function Planning() {
	const [locale, { planning, why }] = await Promise.all([getLocale(), getDictionary()]);
	// The mockups name the same sample calendars and events as the week view in the hero.
	return <PlanningContent locale={locale} copy={planning} sample={{ calendars: why.mockup.calendars, events: why.mockup.events }} />;
}
