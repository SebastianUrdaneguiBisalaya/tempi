'use client';

import { cn } from 'cn';
import { SearchIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { gsap, useMotion } from '@/lib/gsap';
import { useHydrated } from '@/lib/hydrated';
import type { Locale } from '@/lib/i18n';
import { CALENDARS, type CalendarKey, type EventKey } from './app-mockup';

export type EventSearchCopy = {
	placeholder: string;
	/** What the demo types; it should match a few of `RESULTS`. */
	query: string;
};

// Events from the hero's week, so the search finds what the visitor just saw. `day` counts from today.
const RESULTS = [
	{ key: 'designReview', calendar: 'work', day: 0, start: 9, end: 10 },
	{ key: 'codeReview', calendar: 'project', day: 2, start: 11, end: 12 },
	{ key: 'standup', calendar: 'work', day: 1, start: 9, end: 9.5 },
	{ key: 'research', calendar: 'project', day: -2, start: 10, end: 12 },
	{ key: 'retro', calendar: 'work', day: 3, start: 15, end: 16 },
	{ key: 'dentist', calendar: 'personal', day: 2, start: 15, end: 16 },
] as const satisfies readonly { key: EventKey; calendar: CalendarKey; day: number; start: number; end: number }[];

const TYPE_DELAY = 0.12;

type EventSearchReplicaProps = {
	locale: Locale;
	copy: EventSearchCopy;
	events: Record<EventKey, string>;
};

const at = (days: number, hour: number) => {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, Math.floor(hour), (hour % 1) * 60);
};

/** Replica of the right panel's event search (apps/web `event-search.tsx`): results filter on every key. */
export function EventSearchReplica({ locale, copy, events }: EventSearchReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const hydrated = useHydrated();
	const [typed, setTyped] = useState(copy.query);

	useMotion(ref, () => {
		setTyped('');
		const demo = gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.5 });
		for (let index = 1; index <= copy.query.length; index++) {
			demo.call(() => setTyped(copy.query.slice(0, index)), [], `+=${TYPE_DELAY}`);
		}
		return () => setTyped(copy.query);
	});

	const query = typed.trim().toLocaleLowerCase(locale);
	const shown = RESULTS.filter(result => events[result.key].toLocaleLowerCase(locale).includes(query));
	const when = new Intl.DateTimeFormat(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
	const until = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });

	return (
		<div ref={ref} className='w-full max-w-sm overflow-hidden rounded-xl bg-popover text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<div className='flex h-10 items-center gap-2 border-b px-3'>
				<SearchIcon className='size-3.5 shrink-0 opacity-50' />
				<span className='flex min-w-0 items-center'>
					{typed === '' ? <span className='text-muted-foreground'>{copy.placeholder}</span> : <span className='truncate'>{typed}</span>}
					<span className='ml-px h-4 w-px animate-pulse bg-foreground' />
				</span>
			</div>
			{/* Fixed height, so the panel doesn't jump while the list filters. */}
			<ul className='h-64 overflow-hidden p-1'>
				{shown.map((result, index) => (
					<li key={result.key} className={cn('flex items-start gap-2 rounded-md px-2.5 py-1.5', index === 0 && query !== '' && 'bg-muted')}>
						<span className='mt-1.5 size-2 shrink-0 rounded-full' style={{ backgroundColor: CALENDARS[result.calendar] }} />
						<span className='flex min-w-0 flex-col'>
							<span className='truncate font-medium'>{events[result.key]}</span>
							<span className='h-4 truncate text-muted-foreground'>{hydrated && `${when.format(at(result.day, result.start))} – ${until.format(at(result.day, result.end))}`}</span>
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
