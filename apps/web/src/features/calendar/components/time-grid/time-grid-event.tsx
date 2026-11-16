'use client';

import type { DaySegment, EventOccurrence } from '@tempi/core';
import type { PointerEvent, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { EventContextMenu } from '@/features/events/components/event-context-menu';
import { cn } from '@/lib/utils';
import { type EventLook, eventSurface } from '../event-style';
import { boxStyle, MIN_EVENT_MINUTES, SLOT_MINUTES } from './grid-geometry';

type TimeGridEventProps = {
	color: string;
	dayCount: number;
	dayIndex: number;
	focusKey: string;
	isActive: boolean;
	/** Being moved or resized: faded while the preview shows where it goes. */
	isDragged: boolean;
	/** Open in the right panel. */
	isSelected: boolean;
	look: EventLook;
	onMovePointerDown: (pointer: PointerEvent<HTMLElement>) => void;
	onOpen: () => void;
	onResizePointerDown: (pointer: PointerEvent<HTMLElement>) => void;
	ref?: Ref<HTMLButtonElement>;
	segment: DaySegment<EventOccurrence>;
	timeLabel: string;
};

/** One event in a day column, placed by time and lane, tinted with its calendar's color. */
export function TimeGridEvent({
	color,
	dayCount,
	dayIndex,
	focusKey,
	isActive,
	isDragged,
	isSelected,
	look,
	onMovePointerDown,
	onOpen,
	onResizePointerDown,
	ref,
	segment,
	timeLabel,
}: TimeGridEventProps) {
	const { t } = useTranslation();
	const { column, columns, continuesAfter, continuesBefore, endMinute, item: event, startMinute } = segment;
	const drawnEnd = Math.max(endMinute, startMinute + MIN_EVENT_MINUTES);
	// Short events fit only one line: put the time next to the title instead of under it.
	const compact = drawnEnd - startMinute < SLOT_MINUTES * 2;
	const surface = eventSurface(color, look, 22);

	return (
		<EventContextMenu event={event}>
			<button
				aria-description={t('calendar.event.keyboard')}
				aria-keyshortcuts='Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowUp Alt+Shift+ArrowDown Shift+F10 ContextMenu'
				aria-label={[event.title, timeLabel, look.tentative && t('events.status.tentative')].filter(Boolean).join(', ')}
				aria-pressed={isSelected}
				className={cn(
					'absolute z-[5] flex overflow-hidden rounded-md shadow-[0_0_0_1px_var(--background)] border-l-[3px] px-1.5 py-0.5 text-left text-xs/tight outline-none ring-offset-1 focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-ring',
					compact ? 'flex-row items-baseline gap-1' : 'flex-col',
					continuesBefore && 'rounded-t-none',
					continuesAfter && 'rounded-b-none',
					look.past ? 'text-muted-foreground' : 'text-foreground',
					look.tentative && 'border-dashed',
					isSelected && 'z-[6] ring-2 ring-primary',
					isDragged && 'opacity-40'
				)}
				data-event-key={event.key}
				data-focus-key={focusKey}
				onClick={clickEvent => {
					// The slot under the event would start a new one.
					clickEvent.stopPropagation();
					onOpen();
				}}
				onPointerDown={onMovePointerDown}
				ref={ref}
				style={{
					...boxStyle(dayIndex, dayCount, startMinute, drawnEnd, column, columns),
					...surface.style,
					borderLeftColor: surface.accent,
				}}
				tabIndex={isActive ? 0 : -1}
				type='button'
			>
				<span className='truncate font-medium'>{event.title}</span>
				<span className='truncate text-muted-foreground'>{timeLabel}</span>
				{/* The end can only be dragged where the event ends; a segment that continues tomorrow has none. */}
				{!continuesAfter && <span aria-hidden className='absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize' onPointerDown={onResizePointerDown} />}
			</button>
		</EventContextMenu>
	);
}
