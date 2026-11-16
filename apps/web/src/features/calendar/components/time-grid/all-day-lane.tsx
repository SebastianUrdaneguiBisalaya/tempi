'use client';

import type { CalendarEvent, WeekSegment } from '@tempi/core';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { EventChip } from '../event-chip';
import { ALL_DAY_LANE_REM, DAY_HEADER_REM } from './grid-geometry';

type AllDayLaneProps = {
	colorOf: (event: CalendarEvent) => string;
	days: readonly Temporal.PlainDate[];
	hiddenByColumn: readonly number[];
	/** Rows drawn: every lane when expanded, at most two when collapsed. */
	lanes: number;
	onExpand: () => void;
	onOpen: (event: CalendarEvent) => void;
	segments: readonly WeekSegment<CalendarEvent>[];
};

/**
 * Bars for all-day and multi-day events, under the day headers. It spans every day column, so an event over three
 * days is one continuous bar. Screen readers get the same events from each day's column header.
 */
export function AllDayLane({ colorOf, days, hiddenByColumn, lanes, onExpand, onOpen, segments }: AllDayLaneProps) {
	const { t } = useTranslation();
	const percent = (columns: number) => `${(columns / days.length) * 100}%`;
	const top = (lane: number) => `${DAY_HEADER_REM + lane * ALL_DAY_LANE_REM}rem`;
	const height = `${ALL_DAY_LANE_REM - 0.125}rem`;

	return (
		<div className='pointer-events-none sticky top-0 z-[21]' role='presentation' style={{ gridColumn: '2 / -1', gridRow: 1 }}>
			{segments.map(segment => (
				<button
					className='pointer-events-auto absolute px-0.5 text-left'
					key={segment.item.id}
					onClick={() => onOpen(segment.item)}
					style={{ height, left: percent(segment.firstColumn), top: top(segment.lane), width: percent(segment.span) }}
					// Screen readers get these events from the day headers.
					tabIndex={-1}
					type='button'
				>
					<EventChip bar color={colorOf(segment.item)} segment={segment} time='' />
				</button>
			))}
			{days.map((day, column) => {
				const hidden = hiddenByColumn[column] ?? 0;
				return hidden > 0 ? (
					<button
						className='pointer-events-auto absolute truncate rounded-sm px-1.5 text-left text-[0.7rem] font-medium text-muted-foreground hover:bg-accent'
						key={day.toString()}
						onClick={onExpand}
						style={{ height, left: percent(column), top: top(lanes - 1), width: percent(1) }}
						tabIndex={-1}
						type='button'
					>
						{t('calendar.allDay.more', { count: hidden })}
					</button>
				) : null;
			})}
		</div>
	);
}

/** Collapse/expand button for the all-day lane, in the corner above the hour labels. */
export function AllDayToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
	const { t } = useTranslation();
	const label = collapsed ? t('calendar.allDay.expand') : t('calendar.allDay.collapse');
	return (
		<Button aria-expanded={!collapsed} aria-label={label} className='absolute right-1 bottom-1' onClick={onToggle} size='icon-xs' title={label} variant='ghost'>
			{collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
		</Button>
	);
}
