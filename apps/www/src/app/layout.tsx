import { cn } from 'cn';
import type { Metadata } from 'next';
import { Geist_Mono, Instrument_Sans, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' });

const instrumentSans = Instrument_Sans({ subsets: ['latin'], variable: '--font-heading' });

const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
	title: 'Tempi',
	description: 'A local-first desktop calendar for macOS, Windows and Linux.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
	return (
		<html lang='en' className={cn('h-full antialiased', manrope.variable, instrumentSans.variable, geistMono.variable)}>
			<body className='flex min-h-full flex-col'>{children}</body>
		</html>
	);
}
