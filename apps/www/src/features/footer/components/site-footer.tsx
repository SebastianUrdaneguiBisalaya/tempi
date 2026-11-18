import { GitHubDark } from '@ridemountainpig/svgl-react';
import Image from 'next/image';
import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { LanguageSwitcher } from '@/features/header/components/language-switcher';
import { AUTHOR_URL, GITHUB_URL, LEGAL_PAGES } from '@/lib/site';

export async function SiteFooter() {
	const [locale, { footer, header }] = await Promise.all([getLocale(), getDictionary()]);
	const year = new Date().getFullYear();

	return (
		<footer className='mx-auto max-w-6xl px-4 sm:px-6'>
			<div className='flex flex-col gap-6 border-t border-foreground/10 py-8 text-sm text-foreground/70 md:flex-row md:items-center md:justify-between'>
				<div className='flex items-center gap-1'>
					<Image src='/tempi-icon.png' alt='' width={36} height={36} className='-my-2 -ml-2 size-9' />
					<span className='font-heading font-medium text-foreground'>Tempi</span>
					<span className='ml-2'>
						© {year} ·{' '}
						<a href={`${GITHUB_URL}/blob/main/LICENSE`} target='_blank' rel='noreferrer' className='rounded-sm hover:text-foreground'>
							{footer.license}
						</a>
					</span>
				</div>
				<nav aria-label={footer.legal} className='flex items-center gap-4'>
					{LEGAL_PAGES.map(page => (
						<a key={page} href={`/${locale}/${page}`} className='rounded-sm hover:text-foreground'>
							{footer[page]}
						</a>
					))}
				</nav>
				<p>
					{footer.madeBy}{' '}
					<a href={AUTHOR_URL} target='_blank' rel='noreferrer' className='rounded-sm text-foreground underline-offset-4 hover:underline'>
						Sebastian Urdanegui
					</a>
				</p>
				<div className='flex items-center gap-2'>
					<a href={GITHUB_URL} target='_blank' rel='noreferrer' aria-label={header.github} className='flex size-8 items-center justify-center rounded-full hover:bg-muted/50'>
						<GitHubDark aria-hidden className='size-4' />
					</a>
					<LanguageSwitcher locale={locale} label={header.language} />
				</div>
			</div>
		</footer>
	);
}
