import { GitHubDark } from '@ridemountainpig/svgl-react';
import Image from 'next/image';
import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { LanguageSwitcher } from '@/features/header/components/language-switcher';
import { AUTHOR_URL, GITHUB_URL, LEGAL_PAGES, SECTION_IDS } from '@/lib/site';
import { WordmarkFooterFrame } from './wordmark-footer-frame';

/** Every landing section, in page order. */
const FOOTER_SECTIONS = ['why', 'features', 'planning', 'integrations', 'ai', 'keyboard', 'faq', 'download'] as const;

const LINK = 'rounded-sm text-foreground/70 transition-colors hover:text-foreground';

/**
 * The last block of every page, over the wordmark field. Links point at `/{lang}#section`, so they also work from the
 * legal pages.
 */
export async function SiteFooter() {
	const [locale, { footer, header, wordmark }] = await Promise.all([getLocale(), getDictionary()]);
	const year = new Date().getFullYear();

	return (
		<WordmarkFooterFrame label={wordmark.label}>
			{/* Fades keep the links readable where the field's noise is brightest. */}
			<div className='bg-linear-to-b from-background via-background/80 to-transparent'>
				<div className='mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-16 pb-24 text-sm sm:px-6 md:flex-row md:justify-between'>
					<a href={`/${locale}`} className='flex w-fit items-center gap-1 rounded-sm'>
						<Image src='/tempi-icon.png' alt='' width={36} height={36} className='-my-2 -ml-2 size-9' />
						<span className='font-heading font-medium text-foreground'>Tempi</span>
					</a>
					<div className='grid grid-cols-2 gap-10 sm:gap-16'>
						<nav aria-label={footer.navLabel} className='flex flex-col gap-3'>
							<p className='font-medium text-foreground'>{footer.navLabel}</p>
							{FOOTER_SECTIONS.map(section => (
								<a key={section} href={`/${locale}#${SECTION_IDS[section]}`} className={`w-fit ${LINK}`}>
									{footer.sections[section]}
								</a>
							))}
						</nav>
						<nav aria-label={footer.legal} className='flex flex-col gap-3'>
							<p className='font-medium text-foreground'>{footer.legal}</p>
							{LEGAL_PAGES.map(page => (
								<a key={page} href={`/${locale}/${page}`} className={`w-fit ${LINK}`}>
									{footer[page]}
								</a>
							))}
						</nav>
					</div>
				</div>
			</div>
			<div className='mt-auto bg-linear-to-t from-background via-background/80 to-transparent'>
				<div className='mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-16 pb-8 text-sm text-foreground/70 sm:px-6 md:flex-row md:items-center md:justify-between'>
					<p>
						© {year} Tempi ·{' '}
						<a href={`${GITHUB_URL}/blob/main/LICENSE`} target='_blank' rel='noreferrer' className={LINK}>
							{footer.license}
						</a>
					</p>
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
			</div>
		</WordmarkFooterFrame>
	);
}
