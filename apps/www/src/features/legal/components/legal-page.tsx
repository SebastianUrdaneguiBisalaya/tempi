import type { Metadata } from 'next';
import Image from 'next/image';
import { getDictionary, getLocale } from '@/app/[lang]/dictionaries';
import { SiteFooter } from '@/features/footer/components/site-footer';
import { locales } from '@/lib/i18n';
import { AUTHOR_URL, CONTACT_EMAIL, type LEGAL_PAGES } from '@/lib/site';

type LegalPageName = (typeof LEGAL_PAGES)[number];

type Section = { title: string; body: string[]; list?: string[]; links?: { label: string; href: string }[] };

const sectionId = (index: number) => `section-${index + 1}`;

export async function legalMetadata(page: LegalPageName): Promise<Metadata> {
	const [locale, { legal }] = await Promise.all([getLocale(), getDictionary()]);
	const copy = legal[page];
	return {
		title: copy.metaTitle,
		description: copy.metaDescription,
		alternates: {
			canonical: `/${locale}/${page}`,
			languages: Object.fromEntries(locales.map(other => [other, `/${other}/${page}`])),
		},
		openGraph: { title: copy.metaTitle, description: copy.metaDescription, url: `/${locale}/${page}` },
	};
}

/** Terms or privacy: the landing's look, a table of contents and numbered sections. */
export async function LegalPage({ page }: { page: LegalPageName }) {
	const { legal } = await getDictionary();
	const copy = legal[page];
	// Sections differ in shape (some have a list or links); read them through one type.
	const sections: Section[] = copy.sections;

	return (
		<main className='relative isolate flex flex-1 flex-col'>
			<div className='absolute inset-x-0 top-0 -z-10 h-112 overflow-hidden'>
				<Image src='/bg-tempi.png' alt='' fill priority sizes='100vw' className='object-cover object-top opacity-40' />
				<div className='absolute inset-0 bg-linear-to-b from-transparent via-background/60 to-background' />
			</div>

			<article className='mx-auto w-full max-w-3xl px-4 pt-30 pb-24 sm:px-6'>
				<header>
					<p className='font-mono text-xs tracking-[0.3em] text-foreground/60 uppercase'>Tempi</p>
					<h1 className='mt-4 font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl'>{copy.title}</h1>
					<p className='mt-4 text-sm text-foreground/60'>
						{legal.updatedLabel}: <time>{legal.updated}</time>
					</p>
					<div className='mt-8 flex flex-col gap-4 text-base leading-relaxed text-foreground/80'>
						{copy.intro.map(paragraph => (
							<p key={paragraph}>{paragraph}</p>
						))}
					</div>
				</header>

				<nav aria-labelledby='legal-toc' className='mt-12 rounded-3xl border border-foreground/10 bg-background/40 p-6 backdrop-blur-md'>
					<h2 id='legal-toc' className='text-sm font-medium text-foreground/60'>
						{legal.onThisPage}
					</h2>
					<ol className='mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2'>
						{sections.map((section, index) => (
							<li key={section.title} className='flex gap-2'>
								<span className='font-mono text-foreground/40 tabular-nums'>{String(index + 1).padStart(2, '0')}</span>
								<a href={`#${sectionId(index)}`} className='rounded-sm text-foreground/80 underline-offset-4 hover:text-foreground hover:underline'>
									{section.title}
								</a>
							</li>
						))}
					</ol>
				</nav>

				<div className='mt-16 flex flex-col gap-14'>
					{sections.map((section, index) => (
						<section key={section.title} id={sectionId(index)} aria-labelledby={`${sectionId(index)}-title`} className='scroll-mt-28'>
							<h2 id={`${sectionId(index)}-title`} className='flex items-baseline gap-3 font-heading text-2xl font-medium tracking-tight'>
								<span className='font-mono text-sm text-foreground/40 tabular-nums'>{String(index + 1).padStart(2, '0')}</span>
								{section.title}
							</h2>
							<div className='mt-4 flex flex-col gap-4 text-base leading-relaxed text-foreground/75'>
								{section.body.map(paragraph => (
									<p key={paragraph}>{paragraph}</p>
								))}
								{section.list && (
									<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-foreground/40'>
										{section.list.map(item => (
											<li key={item}>{item}</li>
										))}
									</ul>
								)}
								{section.links?.map(link => (
									<a key={link.href} href={link.href} target='_blank' rel='noreferrer' className='w-fit rounded-sm text-foreground underline underline-offset-4'>
										{link.label}
									</a>
								))}
							</div>
						</section>
					))}
				</div>

				<address className='mt-16 flex flex-col gap-1 rounded-3xl border border-foreground/10 bg-background/40 p-6 text-sm not-italic backdrop-blur-md'>
					<span className='font-medium text-foreground/60'>{legal.contactLabel}</span>
					<a href={AUTHOR_URL} target='_blank' rel='noreferrer' className='w-fit rounded-sm text-foreground underline-offset-4 hover:underline'>
						Sebastian Urdanegui
					</a>
					<a href={`mailto:${CONTACT_EMAIL}`} className='w-fit rounded-sm text-foreground underline underline-offset-4'>
						{CONTACT_EMAIL}
					</a>
				</address>
			</article>

			{/* The landing's footer illustration, faded in from the page above. */}
			<div className='relative isolate mt-auto overflow-hidden pt-40'>
				<Image src='/bg-tempi-footer.png' alt='' fill sizes='100vw' className='-z-10 object-cover object-bottom' />
				<div className='absolute inset-x-0 top-0 -z-10 h-2/3 bg-linear-to-b from-background to-transparent' />
				<SiteFooter />
			</div>
		</main>
	);
}
