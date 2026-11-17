import { cn } from 'cn';
import type { Metadata } from 'next';
import { Geist_Mono, Instrument_Sans, Manrope } from 'next/font/google';
import { locales } from '@/lib/i18n';
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

export async function generateMetadata(): Promise<Metadata> {
	const { meta } = await getDictionary();
	return { title: meta.title, description: meta.description };
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
	return (
		<html lang={await getLocale()} className={cn('h-full antialiased', manrope.variable, instrumentSans.variable, geistMono.variable)}>
			<body className='flex min-h-full flex-col'>{children}</body>
		</html>
	);
}
