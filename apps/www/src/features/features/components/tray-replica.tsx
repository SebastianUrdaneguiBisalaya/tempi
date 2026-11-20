'use client';

import { cn } from 'cn';
import Image from 'next/image';
import { useRef } from 'react';
import { onEnter } from '@/components/showcase';
import { Badge } from '@/components/ui/badge';
import { CALENDARS, type CalendarKey, type EventKey } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';
import { useHydrated } from '@/lib/hydrated';
import type { Locale } from '@/lib/i18n';

// Today's events from the hero's week. "Now" is 12:35 there too, so the first two are already over.
const TODAY = [
	{ key: 'designReview', calendar: 'work', start: 9, end: 10 },
	{ key: 'lunch', calendar: 'personal', start: 11.5, end: 12.5 },
	{ key: 'teamSync', calendar: 'work', start: 13, end: 14 },
	{ key: 'focus', calendar: 'project', start: 15, end: 16.5 },
] as const satisfies readonly { key: EventKey; calendar: CalendarKey; start: number; end: number }[];

const NOW_HOUR = 12 + 35 / 60;

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const at = (hour: number) => {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(hour), (hour % 1) * 60);
};

type TrayReplicaProps = {
	locale: Locale;
	today: string;
	events: Record<EventKey, string>;
};

/** The menu bar (or tray) agenda (apps/web `tray-agenda.tsx`): a row of days over today's events; it drops in on enter. */
export function TrayReplica({ locale, today, events }: TrayReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const hydrated = useHydrated();

	useMotion(ref, () => {
		gsap.from('[data-tray-window]', { autoAlpha: 0, y: -10, scale: 0.97, transformOrigin: 'top right', duration: 0.45, ease: 'power3.out', delay: 0.5, scrollTrigger: onEnter(ref.current) });
	});

	const now = new Date();
	const days = Array.from({ length: 7 }, (_, index) => addDays(now, index - 3));
	// Two letters per day, as the app's mini calendar writes them.
	const weekday = (day: Date) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day).slice(0, 2);
	const range = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });

	return (
		<div ref={ref} className='flex w-full max-w-sm flex-col items-end text-xs/relaxed'>
			{/* The system's menu bar, with Tempi's icon pressed. */}
			<div className='flex h-7 w-full items-center justify-end gap-3 rounded-t-lg border-b bg-muted/60 px-3 backdrop-blur'>
				<span className='h-2 w-8 rounded-full bg-muted-foreground/30' />
				<span className='h-2 w-5 rounded-full bg-muted-foreground/30' />
				<span className='flex size-5 items-center justify-center overflow-hidden rounded bg-foreground/15'>
					<Image src='/tempi-icon.png' alt='' width={32} height={32} className='size-8 max-w-none dark:invert' />
				</span>
				<span className='h-2 w-10 rounded-full bg-muted-foreground/30' />
			</div>
			<div data-tray-window className='mt-1.5 mr-4 w-64 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
				<div className='grid grid-cols-7 px-2 py-3'>
					{days.map((day, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: the row always has seven positional days.
						<div key={index} className='flex flex-col items-center gap-1'>
							<span className='text-[0.65rem] text-muted-foreground'>{hydrated && weekday(day)}</span>
							{index === 3 ? <Badge>{hydrated && day.getDate()}</Badge> : <span className='font-medium'>{hydrated && day.getDate()}</span>}
						</div>
					))}
				</div>
				<div className='border-t' />
				<p className='px-4 pt-3 pb-2 font-heading text-sm font-semibold'>{today}</p>
				<ul className='flex flex-col gap-0.5 px-2 pb-3'>
					{TODAY.map(event => (
						<li key={event.key} className={cn('flex items-start gap-2 rounded-md px-2 py-1.5', event.end <= NOW_HOUR && 'text-muted-foreground')}>
							<span className='mt-1 size-2 shrink-0 rounded-full' style={{ backgroundColor: CALENDARS[event.calendar] }} />
							<span className='flex min-w-0 flex-col'>
								<span className='truncate font-medium'>{events[event.key]}</span>
								<span className='h-4 text-muted-foreground'>{hydrated && range.formatRange(at(event.start), at(event.end))}</span>
							</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
