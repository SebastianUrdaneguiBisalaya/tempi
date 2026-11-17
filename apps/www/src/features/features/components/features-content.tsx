'use client';

import { ArchiveIcon, BellRingIcon, CalendarDaysIcon, CircleFadingArrowUpIcon, CommandIcon, GlobeIcon, LanguagesIcon, type LucideIcon, PanelTopIcon, RefreshCwIcon } from 'lucide-react';
import { useRef } from 'react';
import { gsap, useMotion } from '@/lib/gsap';
import { SECTION_IDS } from '@/lib/site';

// Only what Tempi ships today (see the README feature list).
const FEATURES = [
	{ key: 'views', icon: CalendarDaysIcon },
	{ key: 'googleSync', icon: RefreshCwIcon },
	{ key: 'recurrence', icon: BellRingIcon },
	{ key: 'timeZones', icon: GlobeIcon },
	{ key: 'importExport', icon: ArchiveIcon },
	{ key: 'tray', icon: PanelTopIcon },
	{ key: 'keyboard', icon: CommandIcon },
	{ key: 'languages', icon: LanguagesIcon },
	{ key: 'updates', icon: CircleFadingArrowUpIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

type Feature = { title: string; body: string };

export type FeaturesCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	items: Record<(typeof FEATURES)[number]['key'], Feature>;
};

export function FeaturesContent({ copy }: { copy: FeaturesCopy }) {
	const ref = useRef<HTMLElement>(null);

	useMotion(ref, () => {
		gsap.from('[data-features-intro]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 70%' } });
		gsap.from('[data-feature]', {
			y: 24,
			autoAlpha: 0,
			duration: 0.6,
			stagger: 0.08,
			ease: 'power3.out',
			scrollTrigger: { trigger: '[data-feature]', start: 'top 85%' },
		});
	});

	return (
		<section ref={ref} id={SECTION_IDS.features} className='mx-auto w-full max-w-6xl px-4 sm:px-6'>
			<div className='grid gap-12 border-t py-24 md:py-32 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16'>
				<div className='lg:sticky lg:top-28 lg:self-start'>
					<p data-features-intro className='text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>
						{copy.eyebrow}
					</p>
					<h2 data-features-intro className='mt-4 font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl'>
						{copy.title}
					</h2>
					<p data-features-intro className='mt-5 max-w-sm text-base leading-relaxed text-foreground/70'>
						{copy.subtitle}
					</p>
				</div>
				<ul className='grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3'>
					{FEATURES.map(({ key, icon: Icon }) => (
						<li key={key} data-feature>
							<Icon aria-hidden className='size-5 text-foreground/90' />
							<h3 className='mt-4 text-sm font-semibold'>{copy.items[key].title}</h3>
							<p className='mt-1.5 text-sm leading-relaxed text-muted-foreground'>{copy.items[key].body}</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
