'use client';

import { cn } from 'cn';
import { ArrowDownIcon } from 'lucide-react';
import { Fragment, useRef } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { AppMockup, type MockupCopy } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';
import type { Locale } from '@/lib/i18n';
import { SECTION_IDS } from '@/lib/site';
import { DownloadButton } from './download-button';

export type HeroCopy = {
	/** The first line is white; the rest are muted. */
	titleLines: string[];
	subtitle: string;
	download: string;
	downloadForPlatform: string;
	learnMore: string;
};

const PILL = 'h-11 rounded-full px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4';

export function HeroContent({ locale, copy, mockup }: { locale: Locale; copy: HeroCopy; mockup: MockupCopy }) {
	const ref = useRef<HTMLElement>(null);

	useMotion(ref, () => {
		gsap.timeline({ defaults: { ease: 'power3.out' } })
			.from('[data-hero-word]', { yPercent: 110, duration: 0.9, stagger: 0.035 })
			.from('[data-hero-fade]', { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, '-=0.5')
			.from('[data-hero-mockup]', { y: 60, autoAlpha: 0, duration: 1 }, '-=0.4')
			.from('[data-mockup-event]', { x: -12, autoAlpha: 0, duration: 0.5, stagger: 0.18, ease: 'power2.out' }, '-=0.4')
			.from('[data-mockup-now]', { scaleX: 0, transformOrigin: 'left center', duration: 0.6, ease: 'power2.inOut' }, '-=0.2');
	});

	return (
		<section ref={ref} className='mx-auto w-full max-w-6xl px-4 pt-32 pb-8 sm:px-6 md:pt-40'>
			<div className='mx-auto flex max-w-3xl flex-col items-center text-center'>
				<h1 className='font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]'>
					{copy.titleLines.map((line, index) => (
						<HeroLine key={line} text={line} className={index > 0 ? 'text-foreground/50' : undefined} />
					))}
				</h1>
				<p data-hero-fade className='mt-6 max-w-xl text-base leading-relaxed text-foreground/75 sm:text-lg'>
					{copy.subtitle}
				</p>
				<div data-hero-fade className='mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row'>
					<DownloadButton label={copy.download} labelForPlatform={copy.downloadForPlatform} className={PILL} />
					<a href={`#${SECTION_IDS.why}`} className={cn(buttonVariants({ variant: 'outline', className: PILL }))}>
						{copy.learnMore}
						<ArrowDownIcon data-icon='inline-end' />
					</a>
				</div>
			</div>
			<div data-hero-mockup className='mt-16 md:mt-20'>
				<AppMockup locale={locale} copy={mockup} />
			</div>
		</section>
	);
}

type HeroLineProps = {
	text: string;
	className?: string;
};

// One line of the heading, split into words so each can slide up from behind its own clipping box.
function HeroLine({ text, className }: HeroLineProps) {
	return (
		<span className={cn('block', className)}>
			{text.split(' ').map((word, index) => (
				// Words never reorder, so the position plus the word is a stable key.
				// biome-ignore lint/suspicious/noArrayIndexKey: static text split once per render.
				<Fragment key={`${index}-${word}`}>
					<span className='inline-block overflow-hidden pb-[0.1em] align-top'>
						<span data-hero-word className='inline-block'>
							{word}
						</span>
					</span>{' '}
				</Fragment>
			))}
		</span>
	);
}
