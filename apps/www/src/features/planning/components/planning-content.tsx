'use client';

import { BriefcaseIcon, CalendarCheckIcon, ChartColumnIcon, GlobeIcon, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hotkey } from '@/features/keyboard/components/hotkey';
import { gsap, useMotion } from '@/lib/gsap';
import { SHOWN_SHORTCUTS } from '@/lib/hotkeys';
import type { Locale } from '@/lib/i18n';
import { SECTION_IDS } from '@/lib/site';
import { useToday } from '@/lib/use-today';
import { type AvailabilityCopy, AvailabilityMockup } from './availability-mockup';
import { type SampleCopy, type StatsCopy, StatsMockup } from './stats-mockup';

const POINTS = [
	{ key: 'workingHours', icon: BriefcaseIcon },
	{ key: 'timeZones', icon: GlobeIcon },
	{ key: 'availability', icon: CalendarCheckIcon },
	{ key: 'stats', icon: ChartColumnIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

type Point = { title: string; body: string };

type Tab = 'availability' | 'stats';

export type PlanningCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	tabs: Record<Tab, string>;
	points: Record<(typeof POINTS)[number]['key'], Point>;
	shortcut: string;
	availability: AvailabilityCopy;
	stats: StatsCopy;
};

// Seconds the stats report takes to scroll from top to bottom.
const SCROLL_SECONDS = 16;

export function PlanningContent({ locale, copy, sample }: { locale: Locale; copy: PlanningCopy; sample: SampleCopy }) {
	const ref = useRef<HTMLElement>(null);
	const [tab, setTab] = useState<Tab>('availability');
	// The report renders on the client only; its height is known once today is.
	const today = useToday();

	useMotion(ref, () => {
		gsap.from('[data-planning-intro]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 70%' } });
		gsap.from('[data-planning-point]', { x: 16, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', scrollTrigger: { trigger: '[data-planning-point]', start: 'top 85%' } });
	});

	// Scrolls the long report through the drawer's fixed height, like a visitor reading it, while it's on screen.
	useMotion(ref, () => {
		const viewport = ref.current?.querySelector<HTMLElement>('[data-stats-viewport]');
		const report = viewport?.querySelector<HTMLElement>('[data-stats-scroll]');
		if (tab !== 'stats' || today === null || !viewport || !report) return;
		gsap.to(report, {
			y: () => -Math.max(0, report.scrollHeight - viewport.clientHeight),
			duration: SCROLL_SECONDS,
			ease: 'none',
			delay: 1,
			repeat: -1,
			repeatDelay: 1.5,
			yoyo: true,
			scrollTrigger: { trigger: viewport, start: 'top 85%', end: 'bottom 15%', toggleActions: 'play pause resume pause' },
		});
	}, [tab, today]);

	return (
		<section ref={ref} id={SECTION_IDS.planning} className='mx-auto w-full max-w-6xl px-4 sm:px-6'>
			<div className='border-t py-24 md:py-32'>
				<div className='grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-12'>
					<div>
						<p data-planning-intro className='text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>
							{copy.eyebrow}
						</p>
						<h2 data-planning-intro className='mt-4 font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl'>
							{copy.title}
						</h2>
					</div>
					<p data-planning-intro className='max-w-md text-base leading-relaxed text-foreground/70 lg:justify-self-end'>
						{copy.subtitle}
					</p>
				</div>

				<div className='mt-14 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16'>
					<Tabs value={tab} onValueChange={value => setTab(value === 'stats' ? 'stats' : 'availability')} className='min-w-0 gap-4'>
						<TabsList className='self-center'>
							<TabsTrigger value='availability'>{copy.tabs.availability}</TabsTrigger>
							<TabsTrigger value='stats'>{copy.tabs.stats}</TabsTrigger>
						</TabsList>
						{/* A faint stage behind the panels, standing in for the app window they open over. */}
						<div className='flex min-h-[44rem] items-center justify-center rounded-2xl border bg-muted/15 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] p-4 sm:p-10'>
							<TabsContent value='availability' className='w-full max-w-lg flex-none'>
								<AvailabilityMockup locale={locale} copy={copy.availability} calendars={sample.calendars} />
							</TabsContent>
							<TabsContent value='stats' className='w-full max-w-lg flex-none'>
								<StatsMockup locale={locale} copy={copy.stats} sample={sample} />
							</TabsContent>
						</div>
					</Tabs>

					<div className='flex flex-col gap-8 lg:pt-12'>
						<ul className='flex flex-col gap-6'>
							{POINTS.map(({ key, icon: Icon }) => (
								<li key={key} data-planning-point className='flex gap-4'>
									<Icon aria-hidden className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
									<div className='flex flex-col gap-1'>
										<h3 className='text-sm font-medium'>{copy.points[key].title}</h3>
										<p className='text-sm leading-relaxed text-foreground/70'>{copy.points[key].body}</p>
									</div>
								</li>
							))}
						</ul>
						<p data-planning-point className='flex flex-wrap items-center gap-2 border-t pt-6 text-sm text-foreground/70'>
							{copy.shortcut}
							<Hotkey keys={SHOWN_SHORTCUTS.openCommandMenu} />
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
