'use client';

import type { CalendarEvent, DaySegment } from '@tempi/core';
import { cn } from '@/lib/utils';
import { boxStyle, MIN_EVENT_MINUTES, SLOT_MINUTES } from './grid-geometry';

type TimeGridEventProps = {
	color: string;
	dayCount: number;
	dayIndex: number;
	focusKey: string;
	isActive: boolean;
	/** Open in the right panel. */
	isSelected: boolean;
	onOpen: () => void;
	segment: DaySegment<CalendarEvent>;
	timeLabel: string;
};

/** One event in a day column, placed by time and lane, tinted with its calendar's color. */
export function TimeGridEvent({ color, dayCount, dayIndex, focusKey, isActive, isSelected, onOpen, segment, timeLabel }: TimeGridEventProps) {
	const { column, columns, continuesAfter, continuesBefore, endMinute, item: event, startMinute } = segment;
	const drawnEnd = Math.max(endMinute, startMinute + MIN_EVENT_MINUTES);
	// Short events fit only one line: put the time next to the title instead of under it.
	const compact = drawnEnd - startMinute < SLOT_MINUTES * 2;

	return (
		<button
			aria-label={`${event.title}, ${timeLabel}`}
			aria-pressed={isSelected}
			className={cn(
				'absolute z-[5] flex overflow-hidden rounded-md shadow-[0_0_0_1px_var(--background)] border-l-[3px] px-1.5 py-0.5 text-left text-xs/tight text-foreground outline-none ring-offset-1 focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-ring',
				compact ? 'flex-row items-baseline gap-1' : 'flex-col',
				continuesBefore && 'rounded-t-none',
				continuesAfter && 'rounded-b-none',
				event.status === 'tentative' && 'border-dashed',
				isSelected && 'z-[6] ring-2 ring-primary'
			)}
			data-focus-key={focusKey}
			onClick={clickEvent => {
				// The slot under the event would start a new one.
				clickEvent.stopPropagation();
				onOpen();
			}}
			style={{
				...boxStyle(dayIndex, dayCount, startMinute, drawnEnd, column, columns),
				backgroundColor: `color-mix(in oklab, ${color} 22%, var(--background))`,
				borderLeftColor: color,
			}}
			tabIndex={isActive ? 0 : -1}
			type='button'
		>
			<span className='truncate font-medium'>{event.title}</span>
			<span className='truncate text-muted-foreground'>{timeLabel}</span>
		</button>
	);
}
