import { GitHubDark } from '@ridemountainpig/svgl-react';
import Image from 'next/image';
import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { TrackedLink } from '@/components/tracked-link';
import { CookiePreferencesLink } from '@/features/consent/components/cookie-preferences-link';
import { LanguageSwitcher } from '@/features/header/components/language-switcher';
import { AUTHOR_URL, GITHUB_URL, LEGAL_PAGES, SECTION_IDS } from '@/lib/site';
import { WordmarkFooterFrame } from './wordmark-footer-frame';

/** Every landing section, grouped by what it's about, in page order within each group. */
const FOOTER_GROUPS = [
	['product', ['why', 'features', 'integrations']],
	['productivity', ['planning', 'ai', 'keyboard']],
	['start', ['faq', 'download']],
] as const;

const LINK = 'rounded-sm text-foreground/70 transition-colors hover:text-foreground';

/**
 * The last block of every page, over the bracket field: the wordmark on top, then the logo beside the link columns,
 * then the fine print. Links point at `/{lang}#section`, so they also work from the legal pages.
 */
export async function SiteFooter() {
	const [locale, { footer, header, wordmark }] = await Promise.all([getLocale(), getDictionary()]);
	const year = new Date().getFullYear();

	return (
		<WordmarkFooterFrame label={wordmark.label}>
			<div className='mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-8 pb-16 text-sm sm:px-6 md:flex-row md:items-start md:justify-between'>
				<a href={`/${locale}`} className='flex w-fit items-center gap-1 rounded-sm'>
					<Image src='/tempi-icon.png' alt='' width={36} height={36} className='-my-2 -ml-2 size-9' />
					<span className='font-heading font-medium text-foreground'>Tempi</span>
				</a>
				<div className='grid grid-cols-2 gap-10 sm:grid-cols-4 sm:gap-16'>
					{FOOTER_GROUPS.map(([group, sections]) => (
						<nav key={group} aria-label={footer.groups[group]} className='flex flex-col gap-3'>
							<p className='font-medium text-foreground'>{footer.groups[group]}</p>
							{sections.map(section => (
								<a key={section} href={`/${locale}#${SECTION_IDS[section]}`} className={`w-fit ${LINK}`}>
									{footer.sections[section]}
								</a>
							))}
						</nav>
					))}
					<nav aria-label={footer.legal} className='flex flex-col gap-3'>
						<p className='font-medium text-foreground'>{footer.legal}</p>
						{LEGAL_PAGES.map(page => (
							<a key={page} href={`/${locale}/${page}`} className={`w-fit ${LINK}`}>
								{footer[page]}
							</a>
						))}
						<CookiePreferencesLink label={footer.cookiePreferences} className={`w-fit text-left ${LINK}`} />
					</nav>
				</div>
			</div>
			<div className='mx-auto flex max-w-6xl flex-col gap-6 border-t border-foreground/10 px-4 py-8 text-sm text-foreground/70 sm:px-6 md:flex-row md:items-center md:justify-between'>
				<p>
					© {year} Tempi ·{' '}
					<a href={`${GITHUB_URL}/blob/main/LICENSE`} target='_blank' rel='noreferrer' className={LINK}>
						{footer.license}
					</a>
				</p>
				<p>
					{footer.madeBy}{' '}
					<TrackedLink event='author_click' params={{}} href={AUTHOR_URL} target='_blank' rel='noreferrer' className='rounded-sm text-foreground underline-offset-4 hover:underline'>
						Sebastian Urdanegui
					</TrackedLink>
				</p>
				<div className='flex items-center gap-2'>
					<TrackedLink
						event='github_click'
						params={{ source: 'footer' }}
						href={GITHUB_URL}
						target='_blank'
						rel='noreferrer'
						aria-label={header.github}
						className='flex size-8 items-center justify-center rounded-full hover:bg-muted/50'
					>
						<GitHubDark aria-hidden className='size-4' />
					</TrackedLink>
					<LanguageSwitcher locale={locale} label={header.language} />
				</div>
			</div>
		</WordmarkFooterFrame>
	);
}
