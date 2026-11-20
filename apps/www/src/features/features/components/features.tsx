import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { FeaturesContent } from './features-content';

export async function Features() {
	const [locale, { features, why, keyboard }] = await Promise.all([getLocale(), getDictionary()]);
	const shared = {
		mockup: why.mockup,
		settingsTabs: why.replicas.settingsTabs,
		google: why.replicas.google,
		shortcuts: { groups: keyboard.groups, actions: keyboard.actions },
	};
	return <FeaturesContent locale={locale} copy={features} shared={shared} />;
}
