'use client';

import type { CalendarEvent, WeekSegment } from '@tempi/core';
import { cn } from '@/lib/utils';

type EventChipProps = {
	/** Draw it as a filled bar even if it fits in one day (e.g. in the all-day lane). */
	bar?: boolean;
	color: string;
	segment: Pick<WeekSegment<CalendarEvent>, 'continuesAfter' | 'continuesBefore' | 'item' | 'span'>;
	/** Start time of a timed event, already formatted. */
	time: string;
};

/**
 * One event in a day cell (month view, all-day lane). All-day and multi-day events are filled bars (which span their days); timed events
 * that fit in one day are a colored dot, the start time and the title, like Google Calendar.
 */
export function EventChip({ bar = false, color, segment, time }: EventChipProps) {
	const { continuesAfter, continuesBefore, item: event, span } = segment;
	const isBar = bar || event.allDay || span > 1 || continuesBefore || continuesAfter;

	if (isBar) {
		return (
			<div
				className={cn('flex h-full items-center truncate rounded-sm px-1.5 text-[0.7rem] font-medium text-foreground', continuesBefore && 'rounded-l-none', continuesAfter && 'rounded-r-none')}
				style={{ backgroundColor: `color-mix(in oklab, ${color} 30%, var(--background))` }}
			>
				<span className='truncate'>{event.title}</span>
			</div>
		);
	}

	return (
		<div className={cn('flex h-full items-center gap-1 truncate rounded-sm px-1 text-[0.7rem]', event.status === 'tentative' && 'opacity-70')}>
			<span aria-hidden className='size-1.5 shrink-0 rounded-full' style={{ backgroundColor: color }} />
			<span className='hidden shrink-0 text-muted-foreground sm:inline'>{time}</span>
			<span className='truncate font-medium'>{event.title}</span>
		</div>
	);
}
