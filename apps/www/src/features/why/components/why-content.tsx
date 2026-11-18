'use client';

import { LockIcon, type LucideIcon, RefreshCwIcon, ShieldCheckIcon, ZapIcon } from 'lucide-react';
import { useRef } from 'react';
import { gsap, useMotion } from '@/lib/gsap';
import { SECTION_IDS } from '@/lib/site';
import type { MockupCopy } from './app-mockup';

const PILLARS = [
	{ key: 'local', icon: LockIcon },
	{ key: 'fast', icon: ZapIcon },
	{ key: 'sync', icon: RefreshCwIcon },
	{ key: 'lasting', icon: ShieldCheckIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

type Pillar = { title: string; body: string };

export type WhyCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	pillars: Record<(typeof PILLARS)[number]['key'], Pillar>;
	/** Rendered by the hero; it stays here so the dictionary keeps its shape. */
	mockup: MockupCopy;
};

export function WhyContent({ copy }: { copy: WhyCopy }) {
	const ref = useRef<HTMLElement>(null);

	useMotion(ref, () => {
		const reveal = { trigger: ref.current, start: 'top 70%' };
		gsap.from('[data-why-intro]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: reveal });
		gsap.from('[data-why-pillar]', { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out', delay: 0.2, scrollTrigger: { trigger: '[data-why-pillar]', start: 'top 85%' } });
	});

	return (
		<section ref={ref} id={SECTION_IDS.why} className='mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 md:py-32'>
			<div className='grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-12'>
				<div>
					<p data-why-intro className='text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>
						{copy.eyebrow}
					</p>
					<h2 data-why-intro className='mt-4 font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl'>
						{copy.title}
					</h2>
				</div>
				<p data-why-intro className='max-w-md text-base leading-relaxed text-foreground/70 lg:justify-self-end'>
					{copy.subtitle}
				</p>
			</div>
			<ul className='mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
				{PILLARS.map(({ key, icon: Icon }) => (
					<li key={key} data-why-pillar className='flex flex-col gap-4 rounded-xl border bg-muted/20 p-5'>
						<span className='flex size-10 items-center justify-center rounded-lg border bg-muted/40'>
							<Icon aria-hidden className='size-4.5' />
						</span>
						<div>
							<h3 className='text-sm font-semibold'>{copy.pillars[key].title}</h3>
							<p className='mt-1.5 text-sm leading-relaxed text-muted-foreground'>{copy.pillars[key].body}</p>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}
