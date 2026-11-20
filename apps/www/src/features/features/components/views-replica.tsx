'use client';

import { cn } from 'cn';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CALENDARS, type CalendarKey, eventStyle } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';

const VIEWS = ['day', 'week', 'month'] as const;

type View = (typeof VIEWS)[number];

// Blocks for a schematic week: [column, start row, rows, calendar] on a grid of 7 columns and 8 rows.
const WEEK_BLOCKS = [
	[0, 1, 2, 'personal'],
	[1, 0, 1, 'work'],
	[1, 3, 3, 'work'],
	[2, 2, 2, 'project'],
	[3, 0, 1, 'work'],
	[3, 4, 2, 'personal'],
	[4, 1, 2, 'work'],
	[4, 5, 2, 'project'],
	[5, 2, 3, 'project'],
	[6, 1, 2, 'personal'],
] as const satisfies readonly [number, number, number, CalendarKey][];

const DAY_BLOCKS = [
	[0, 1, 'work'],
	[2, 1, 'personal'],
	[3, 2, 'work'],
	[5, 2, 'project'],
] as const satisfies readonly [number, number, CalendarKey][];

// Month cells that hold events, by index in a 5×7 grid.
const MONTH_EVENTS: Partial<Record<number, CalendarKey[]>> = {
	2: ['work'],
	4: ['personal', 'work'],
	8: ['project'],
	10: ['work', 'work'],
	13: ['personal'],
	16: ['work', 'project'],
	18: ['work', 'personal', 'project'],
	22: ['personal'],
	24: ['work'],
	26: ['project', 'work'],
	30: ['work'],
	33: ['personal'],
};

/** The view switcher from the app's header over a schematic of each view; on enter it steps through all three. */
export function ViewsReplica({ labels }: { labels: Record<View, string> }) {
	const ref = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<View>('week');

	useMotion(ref, () => {
		setView('day');
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.8 })
			.call(() => setView('month'))
			.call(() => setView('week'), [], '+=1.6');
		return () => setView('week');
	});

	return (
		<div ref={ref} className='flex w-full max-w-md flex-col gap-3 rounded-xl bg-popover p-3 text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<ToggleGroup value={[view]} variant='outline' className='self-end'>
				{VIEWS.map(item => (
					<ToggleGroupItem key={item} value={item} tabIndex={-1}>
						{labels[item]}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<div className='h-52'>
				{view === 'day' && (
					<div className='grid h-full grid-rows-8 gap-y-0 border-t'>
						{DAY_BLOCKS.map(([row, rows, calendar]) => (
							<div key={row} className='mx-0.5 rounded-sm border-l-[3px]' style={{ gridRow: `${row + 1} / span ${rows}`, gridColumn: 1, ...eventStyle(CALENDARS[calendar]) }} />
						))}
					</div>
				)}
				{view === 'week' && (
					<div className='grid h-full grid-cols-7 grid-rows-8 border-t'>
						{Array.from({ length: 7 }, (_, column) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: the week always has seven positional columns.
							<div key={column} className={cn('row-span-8 border-l', column === 0 && 'border-l-0')} style={{ gridColumn: column + 1, gridRow: '1 / -1' }} />
						))}
						{WEEK_BLOCKS.map(([column, row, rows, calendar]) => (
							<div
								key={`${column}-${row}`}
								className='mx-0.5 rounded-sm border-l-[3px]'
								style={{ gridColumn: column + 1, gridRow: `${row + 1} / span ${rows}`, ...eventStyle(CALENDARS[calendar]) }}
							/>
						))}
					</div>
				)}
				{view === 'month' && (
					<div className='grid h-full grid-cols-7 grid-rows-5 border-t border-l'>
						{Array.from({ length: 35 }, (_, cell) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: the month always has 35 positional cells.
							<div key={cell} className='flex flex-col gap-0.5 border-r border-b p-0.5'>
								{MONTH_EVENTS[cell]?.map((calendar, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: chips are positional inside their cell.
									<span key={index} className='h-1.5 rounded-full' style={{ backgroundColor: CALENDARS[calendar] }} />
								))}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
