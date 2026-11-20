'use client';

import { cn } from 'cn';
import { ArrowDownIcon } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import { AsciiNoise } from '@/components/ascii-noise';
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

// As strong as the wordmark band's; the mask keeps it clear of the title.
const NOISE_OPACITY = 1;

export function HeroContent({ locale, copy, mockup }: { locale: Locale; copy: HeroCopy; mockup: MockupCopy }) {
	const ref = useRef<HTMLElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const mockupRef = useRef<HTMLDivElement>(null);

	// The noise reaches down to the middle of the mockup, whose height depends on the viewport; follow its layout.
	useEffect(() => {
		const wrapper = wrapperRef.current;
		const mockupElement = mockupRef.current;
		if (!wrapper || !mockupElement) return;
		// Layout offsets ignore the mockup's entrance transform, so the noise doesn't jump while it slides in.
		const measure = () => wrapper.style.setProperty('--noise-height', `${mockupElement.offsetTop + mockupElement.offsetHeight / 2}px`);
		const observer = new ResizeObserver(measure);
		observer.observe(wrapper);
		observer.observe(mockupElement);
		return () => observer.disconnect();
	}, []);

	useMotion(ref, () => {
		gsap.timeline({ defaults: { ease: 'power3.out' } })
			.from('[data-hero-word]', { yPercent: 110, duration: 0.9, stagger: 0.035 })
			.from('[data-hero-fade]', { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, '-=0.5')
			.from('[data-hero-mockup]', { y: 60, autoAlpha: 0, duration: 1 }, '-=0.4')
			.from('[data-mockup-event]', { x: -12, autoAlpha: 0, duration: 0.5, stagger: 0.18, ease: 'power2.out' }, '-=0.4')
			.from('[data-mockup-now]', { scaleX: 0, transformOrigin: 'left center', duration: 0.6, ease: 'power2.inOut' }, '-=0.2');
	});

	return (
		<div ref={wrapperRef} className='relative isolate'>
			{/* Clear behind the title and subtitle so the glyphs never compete with the text, and faded out at the bottom. */}
			<AsciiNoise
				opacity={NOISE_OPACITY}
				spotlight
				className='absolute inset-x-0 top-0 -z-10 h-(--noise-height,0px) [mask-composite:intersect] [mask-image:radial-gradient(ellipse_42rem_14rem_at_50%_17rem,rgb(0_0_0/0.35)_30%,black),linear-gradient(to_bottom,black_65%,transparent)]'
			/>
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
				<div ref={mockupRef} data-hero-mockup className='mt-16 md:mt-20'>
					<AppMockup locale={locale} copy={mockup} />
				</div>
			</section>
		</div>
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
