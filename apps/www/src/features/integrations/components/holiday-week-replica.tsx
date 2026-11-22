'use client';

import { cn } from 'cn';
import { Badge } from '@/components/ui/badge';
import { eventStyle } from '@/features/why/components/app-mockup';
import type { Locale } from '@/lib/i18n';
import { ALL_DAY, addDays, CALENDARS, type EventKey, eventsOn } from '@/lib/sample-calendar';
import { useToday } from '@/lib/use-today';

export type HolidayWeekCopy = { holiday: string };

/** Today and the six days after it, as offsets from today. */
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const FIRST_HOUR = 9;
const LAST_HOUR = 13;
const HOUR_REM = 2.5;

/**
 * Seven days from today in the app's week layout: a public holiday in the all-day lane (where the holidays integration
 * puts it) and the morning of the sample week below. The app shows the weather only in its sidebar card, never per
 * day, so neither does this. Dates are rendered on the client only, like the hero's week view.
 */
export function HolidayWeekReplica({ locale, copy, events }: { locale: Locale; copy: HolidayWeekCopy; events: Record<EventKey, string> }) {
	const today = useToday();
	const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => FIRST_HOUR + index);

	return (
		<div className='w-full max-w-md overflow-hidden rounded-xl bg-popover text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<div className='grid grid-cols-7 border-b'>
				{DAYS.map(offset => {
					const day = today ? addDays(today, offset) : null;
					return (
						<div key={offset} className={cn('flex flex-col items-center gap-1 px-0.5 py-2', offset > 0 && 'border-l')}>
							<span className={cn('text-[0.65rem] text-muted-foreground', offset === 0 && 'font-medium text-foreground')}>
								{day ? new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day) : ' '}
							</span>
							{offset === 0 ? <Badge>{day?.getDate() ?? ' '}</Badge> : <span className='font-medium'>{day?.getDate() ?? ' '}</span>}
						</div>
					);
				})}
			</div>
			{/* All-day lane: the holiday the integration added, in the calendar's color. */}
			<div className='grid grid-cols-7 border-b'>
				{DAYS.map(offset => (
					<div key={offset} className={cn('p-0.5', offset > 0 && 'border-l')}>
						{offset === ALL_DAY.day ? (
							<div className='truncate rounded-sm border-l-[3px] px-1 py-0.5 text-[0.65rem] font-medium' style={eventStyle(CALENDARS[ALL_DAY.calendar])}>
								{copy.holiday}
							</div>
						) : (
							<div className='h-5' />
						)}
					</div>
				))}
			</div>
			<div className='relative grid grid-cols-7' style={{ height: `${hours.length * HOUR_REM}rem` }}>
				{DAYS.map(offset => (
					<div key={offset} className={cn('relative', offset > 0 && 'border-l')}>
						{hours.map(hour => (
							<div key={hour} className={cn(hour > FIRST_HOUR && 'border-t')} style={{ height: `${HOUR_REM}rem` }} />
						))}
						{eventsOn(today, offset)
							.filter(event => event.start < LAST_HOUR && event.end > FIRST_HOUR)
							.map(event => {
								const start = Math.max(event.start, FIRST_HOUR);
								const end = Math.min(event.end, LAST_HOUR);
								return (
									<div
										key={`${event.key}-${event.start}`}
										className='absolute inset-x-0.5 truncate rounded-sm border-l-[3px] px-1 py-0.5 text-[0.6rem] font-medium'
										style={{ top: `${(start - FIRST_HOUR) * HOUR_REM}rem`, height: `${(end - start) * HOUR_REM}rem`, ...eventStyle(CALENDARS[event.calendar]) }}
									>
										{events[event.key]}
									</div>
								);
							})}
					</div>
				))}
			</div>
		</div>
	);
}
