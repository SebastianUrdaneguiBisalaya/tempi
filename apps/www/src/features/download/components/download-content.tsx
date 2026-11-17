'use client';

import { DownloadIcon } from 'lucide-react';
import Image from 'next/image';
import { type ReactNode, useRef } from 'react';
import { gsap, useMotion } from '@/lib/gsap';
import { PLATFORMS } from '@/lib/platform';
import { SECTION_IDS } from '@/lib/site';
import { PlatformButton } from './platform-button';

export type DownloadCopy = {
	title: string;
	subtitle: string;
	/** With an `{os}` placeholder: the accessible name of a platform's variants menu. */
	choose: string;
	firstLaunch: string;
	firstLaunchLink: string;
};

/** The download section over the footer illustration; the footer is passed in so both share the background. */
export function DownloadContent({ copy, footer }: { copy: DownloadCopy; footer: ReactNode }) {
	const ref = useRef<HTMLElement>(null);

	useMotion(ref, () => {
		gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top 80%', once: true }, defaults: { ease: 'power3.out' } })
			.from('[data-download-reveal]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1 })
			.from('[data-download-button]', { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, '-=0.4');
		gsap.from('[data-download-bg]', { scale: 1.1, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom bottom', scrub: true } });
	});

	return (
		<section ref={ref} id={SECTION_IDS.download} className='relative isolate overflow-hidden'>
			{/* next/image serves the 2 MB PNG resized and in a modern format. */}
			<div data-download-bg className='absolute inset-0 -z-10'>
				<Image src='/bg-tempi-footer.png' alt='' fill sizes='100vw' className='object-cover object-bottom' />
			</div>
			{/* Blend the illustration into the page above it. */}
			<div className='absolute inset-x-0 top-0 -z-10 h-1/2 bg-linear-to-b from-background to-transparent' />

			<div className='mx-auto flex max-w-6xl flex-col items-center px-4 pt-32 pb-40 text-center sm:px-6 md:pt-40 md:pb-56'>
				<DownloadIcon data-download-reveal aria-hidden className='size-6' />
				<h2 data-download-reveal className='mt-5 font-heading text-4xl font-medium tracking-tight sm:text-5xl'>
					{copy.title}
				</h2>
				<p data-download-reveal className='mt-4 max-w-md text-base leading-relaxed text-foreground/70'>
					{copy.subtitle}
				</p>
				<div className='mt-10 flex flex-wrap justify-center gap-3'>
					{/* GSAP animates the wrappers: the buttons' own `transition-all` would fight its inline styles. */}
					{PLATFORMS.map(platform => (
						<div key={platform} data-download-button>
							<PlatformButton platform={platform} chooseLabel={copy.choose} />
						</div>
					))}
				</div>
				<p data-download-reveal className='mt-8 max-w-md text-sm text-balance text-foreground/80'>
					{copy.firstLaunch}{' '}
					<a href={`#${SECTION_IDS.faq}`} className='rounded-sm text-foreground underline underline-offset-4'>
						{copy.firstLaunchLink}
					</a>
				</p>
			</div>
			{footer}
		</section>
	);
}
