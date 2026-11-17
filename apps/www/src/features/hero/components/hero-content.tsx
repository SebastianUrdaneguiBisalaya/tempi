'use client';

import { cn } from 'cn';
import { ArrowDownIcon } from 'lucide-react';
import Image from 'next/image';
import { Fragment, useRef } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { gsap, useMotion } from '@/lib/gsap';
import { SECTION_IDS } from '@/lib/site';
import { DownloadButton } from './download-button';

export type HeroCopy = {
	/** The first line is white; the rest are muted. */
	titleLines: string[];
	subtitle: string;
	download: string;
	downloadForPlatform: string;
	learnMore: string;
	imageAlt: string;
};

const PILL = 'h-11 rounded-full px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4';

export function HeroContent({ copy }: { copy: HeroCopy }) {
	const ref = useRef<HTMLElement>(null);

	useMotion(ref, () => {
		gsap.timeline({ defaults: { ease: 'power3.out' } })
			.from('[data-hero-word]', { yPercent: 110, duration: 0.9, stagger: 0.035 })
			.from('[data-hero-fade]', { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, '-=0.5')
			.from('[data-hero-bg]', { scale: 1.08, duration: 1.8, ease: 'power2.out' }, 0);

		gsap.to('[data-hero-parallax]', {
			yPercent: 12,
			ease: 'none',
			scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: true },
		});
	});

	return (
		<section ref={ref} className='relative isolate flex min-h-[40rem] items-center overflow-hidden md:min-h-[46rem]'>
			{/* Taller than the section so the parallax never shows an edge. */}
			<div data-hero-parallax className='absolute inset-x-0 -top-[8%] -bottom-[8%] -z-10'>
				<Image data-hero-bg src='/bg-tempi.png' alt={copy.imageAlt} fill priority sizes='100vw' className='object-cover object-[72%_center] opacity-30' />
			</div>
			{/* Fade the illustration into the page at both edges. */}
			<div className='absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-linear-to-b from-transparent to-background' />
			<div className='absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-background/80 to-transparent' />

			<div className='mx-auto w-full max-w-6xl px-4 pt-24 pb-16 sm:px-6'>
				<div className='max-w-3xl'>
					<h1 className='font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]'>
						{copy.titleLines.map((line, index) => (
							<HeroLine key={line} text={line} className={index > 0 ? 'text-foreground/50' : undefined} />
						))}
					</h1>
					<p data-hero-fade className='mt-6 max-w-xl text-base leading-relaxed text-foreground/75 sm:text-lg'>
						{copy.subtitle}
					</p>
					<div data-hero-fade className='mt-9 flex flex-col gap-3 sm:flex-row'>
						<DownloadButton label={copy.download} labelForPlatform={copy.downloadForPlatform} className={PILL} />
						<a href={`#${SECTION_IDS.why}`} className={cn(buttonVariants({ variant: 'outline', className: `${PILL} bg-background/20! backdrop-blur-sm` }))}>
							{copy.learnMore}
							<ArrowDownIcon data-icon='inline-end' />
						</a>
					</div>
				</div>
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
