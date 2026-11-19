'use client';

import type { EventOccurrence } from '@tempi/core';
import type { MonthMorePopoverProps } from '@usecalendar/react';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';

/**
 * A month day's "+N more" in the app's popover, instead of the calendar's native one, so it looks and behaves like the
 * rest of the app's popovers. The list is the calendar's own: each event opens on click and keeps its context menu.
 */
export function MonthMorePopover({ label, list, title }: MonthMorePopoverProps<EventOccurrence>) {
	return (
		<Popover>
			<PopoverTrigger
				className='block size-full cursor-pointer truncate rounded-sm px-1 text-left text-[0.7rem] font-medium text-muted-foreground hover:bg-accent'
				// Keyboard users reach a day's events through the day itself (Enter opens the day view).
				tabIndex={-1}
			>
				{label}
			</PopoverTrigger>
			<PopoverContent className='w-64'>
				<PopoverHeader>
					<PopoverTitle>{title}</PopoverTitle>
				</PopoverHeader>
				{list}
			</PopoverContent>
		</Popover>
	);
}
