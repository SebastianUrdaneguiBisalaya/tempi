import { cn } from 'cn';
import type { Metadata } from 'next';
import { Geist_Mono, Instrument_Sans, Manrope } from 'next/font/google';
import { ConsentManager } from '@/features/consent/components/consent-manager';
import { SiteHeader } from '@/features/header/components/site-header';
import { type Locale, locales } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import { SmoothScroll } from '@/lib/smooth-scroll';
import { getDictionary, getLocale } from './dictionaries';
import '../globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' });

const instrumentSans = Instrument_Sans({ subsets: ['latin'], variable: '--font-heading' });

const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

// Any other locale is a 404 instead of a dynamic render.
export const dynamicParams = false;

export function generateStaticParams() {
	return locales.map(lang => ({ lang }));
}

const OPEN_GRAPH_LOCALES = { en: 'en_US', es: 'es_ES' } as const satisfies Record<Locale, string>;

export async function generateMetadata(): Promise<Metadata> {
	const [locale, { meta }] = await Promise.all([getLocale(), getDictionary()]);
	return {
		metadataBase: new URL(SITE_URL),
		title: meta.title,
		description: meta.description,
		applicationName: 'Tempi',
		alternates: {
			canonical: `/${locale}`,
			// `/` redirects each visitor to their language, so it is the default for everyone else.
			languages: { ...Object.fromEntries(locales.map(other => [other, `/${other}`])), 'x-default': '/' },
		},
		openGraph: {
			type: 'website',
			siteName: 'Tempi',
			title: meta.title,
			description: meta.description,
			url: `/${locale}`,
			locale: OPEN_GRAPH_LOCALES[locale],
			alternateLocale: locales.filter(other => other !== locale).map(other => OPEN_GRAPH_LOCALES[other]),
		},
		twitter: { card: 'summary_large_image', title: meta.title, description: meta.description },
	};
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
	const [locale, { consent, footer }] = await Promise.all([getLocale(), getDictionary()]);
	return (
		<html lang={locale} className={cn('h-full antialiased', manrope.variable, instrumentSans.variable, geistMono.variable)}>
			<body className='flex min-h-full flex-col'>
				<ConsentManager locale={locale} copy={consent} privacyLabel={footer.privacy}>
					<SmoothScroll />
					<SiteHeader />
					{children}
				</ConsentManager>
			</body>
		</html>
	);
}
