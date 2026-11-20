'use client';

import { cn } from 'cn';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Button } from '@/components/ui/button';
import { CALENDARS, type CalendarKey, eventStyle } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';
import { SHOWN_SHORTCUTS } from '@/lib/hotkeys';
import { Hotkey } from './hotkey';

export type UndoCopy = {
	/** The toast after deleting. */
	deleted: string;
	undo: string;
	/** The toast after undoing. */
	restored: string;
};

type DayEvent = { title: string; calendar: CalendarKey; start: number; end: number };

type UndoReplicaProps = {
	copy: UndoCopy;
	/** The day's events; the second one is deleted and brought back. */
	events: readonly [DayEvent, DayEvent, DayEvent];
};

const FIRST_HOUR = 9;
const HOUR_REM = 2.75;

/** A day column and the delete toast; on enter an event is deleted and ⌘Z restores it, as the toast's Undo does. */
export function UndoReplica({ copy, events }: UndoReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [deleted, setDeleted] = useState(false);
	const [restored, setRestored] = useState(false);
	const [pressed, setPressed] = useState(false);

	useMotion(ref, () => {
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.8 })
			.call(() => setDeleted(true))
			.call(() => setPressed(true), [], '+=1.6')
			.call(
				() => {
					setPressed(false);
					setDeleted(false);
					setRestored(true);
				},
				[],
				'+=0.25'
			)
			.call(() => setRestored(false), [], '+=2');
		return () => {
			setDeleted(false);
			setRestored(false);
			setPressed(false);
		};
	});

	return (
		<div ref={ref} className='flex w-full max-w-sm flex-col items-center gap-4 text-xs/relaxed'>
			<span className={cn('flex items-center gap-2 rounded-lg border bg-popover px-2.5 py-1.5 shadow-lg transition-transform duration-150', pressed && 'scale-95 border-foreground/40')}>
				<Hotkey keys={SHOWN_SHORTCUTS.undo} />
				<span className='text-muted-foreground'>{copy.undo}</span>
			</span>
			<div className='relative w-full overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
				<div className='relative' style={{ height: `${6 * HOUR_REM}rem` }}>
					{Array.from({ length: 6 }, (_, hour) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: hour lines are positional.
						<div key={hour} className={cn('border-t', hour === 0 && 'border-t-0')} style={{ height: `${HOUR_REM}rem` }} />
					))}
					{events.map((event, index) => (
						<div
							key={event.title}
							className={cn('absolute inset-x-2 flex flex-col rounded-md border-l-[3px] px-2 py-1 transition-all duration-300', index === 1 && deleted && 'scale-95 opacity-0')}
							style={{ top: `${(event.start - FIRST_HOUR) * HOUR_REM}rem`, height: `${(event.end - event.start) * HOUR_REM}rem`, ...eventStyle(CALENDARS[event.calendar]) }}
						>
							<span className='truncate font-medium'>{event.title}</span>
						</div>
					))}
				</div>
				<div
					className={cn(
						'absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-lg bg-popover px-3 py-2 shadow-xl ring-1 ring-foreground/10 transition-all duration-300',
						!deleted && !restored && 'translate-y-4 opacity-0'
					)}
				>
					<span>{restored ? copy.restored : copy.deleted}</span>
					{deleted && (
						<Button size='sm' variant='outline'>
							{copy.undo}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
