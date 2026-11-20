'use client';

import { cn } from 'cn';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Badge } from '@/components/ui/badge';
import { gsap, useMotion } from '@/lib/gsap';
import { useHydrated } from '@/lib/hydrated';
import type { Locale } from '@/lib/i18n';
import { Hotkey } from './hotkey';

const KEYS = [
	{ action: 'previous', key: 'k' },
	{ action: 'next', key: 'j' },
	{ action: 'goToToday', key: 't' },
] as const;

type Action = (typeof KEYS)[number]['action'];

type NavigationReplicaProps = {
	locale: Locale;
	today: string;
	actions: Record<Action, string>;
};

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** The calendar header and week row moving with J, K and T; on enter it goes forward twice and back to today. */
export function NavigationReplica({ locale, today, actions }: NavigationReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const hydrated = useHydrated();
	const [week, setWeek] = useState(0);
	const [pressed, setPressed] = useState<Action | null>(null);

	useMotion(ref, () => {
		const press = (action: Action, change: (current: number) => number) => () => {
			setPressed(action);
			setWeek(change);
		};
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 })
			.call(press('next', current => current + 1))
			.call(() => setPressed(null), [], '+=0.25')
			.call(
				press('next', current => current + 1),
				[],
				'+=0.6'
			)
			.call(() => setPressed(null), [], '+=0.25')
			.call(
				press('goToToday', () => 0),
				[],
				'+=0.9'
			)
			.call(() => setPressed(null), [], '+=0.25');
		return () => {
			setWeek(0);
			setPressed(null);
		};
	});

	const now = new Date();
	const weekStart = locale === 'es' ? 1 : 0;
	const first = addDays(now, week * 7 - ((now.getDay() - weekStart + 7) % 7));
	const days = Array.from({ length: 7 }, (_, index) => addDays(first, index));
	const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
	const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });

	return (
		<div ref={ref} className='flex w-full max-w-md flex-col gap-4 text-xs/relaxed'>
			<div className='overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
				<div className='flex items-center gap-2 border-b px-3 py-2'>
					<span className='flex h-7 items-center rounded-md border px-2 font-medium dark:bg-input/30'>{today}</span>
					<span className='flex items-center text-muted-foreground'>
						<ChevronLeftIcon className='size-4' />
						<ChevronRightIcon className='size-4' />
					</span>
					<span className='font-heading text-sm font-semibold first-letter:uppercase'>{hydrated && month.format(days[3] ?? now)}</span>
				</div>
				<div className='grid grid-cols-7'>
					{days.map((day, index) => {
						const isToday = hydrated && day.toDateString() === now.toDateString();
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: the week always has seven positional columns.
							<div key={index} className='flex h-14 flex-col items-center justify-center gap-1 border-l first:border-l-0'>
								<span className='text-muted-foreground'>{hydrated && weekday.format(day)}</span>
								{isToday ? <Badge>{day.getDate()}</Badge> : <span className='font-medium'>{hydrated && day.getDate()}</span>}
							</div>
						);
					})}
				</div>
			</div>
			<ul className='flex flex-wrap justify-center gap-2'>
				{KEYS.map(({ action, key }) => (
					<li
						key={action}
						className={cn(
							'flex items-center gap-2 rounded-lg border bg-popover px-2.5 py-1.5 shadow-lg transition-transform duration-150',
							pressed === action && 'scale-95 border-foreground/40'
						)}
					>
						<Hotkey keys={[key]} />
						<span className='text-muted-foreground'>{actions[action]}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
