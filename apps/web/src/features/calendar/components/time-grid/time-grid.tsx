'use client';

import { belongsInAllDayLane, type CalendarEvent, type DaySegment, DEFAULT_SETTINGS, daysToUtcRange, fitWeek, layoutDay, layoutWeek, resolveLanguage } from '@tempi/core';
import { type FocusEvent, type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useSetAllDayCollapsed, useSettings } from '@/features/settings/hooks/use-settings';
import { formatDate, formatTime, formatTimeRange, formatWeekday } from '@/lib/date-format';
import { toUtcDate } from '@/lib/plain-date';
import { cn } from '@/lib/utils';
import { useCalendars } from '../../hooks/use-calendars';
import { useEvents } from '../../hooks/use-events';
import { AllDayLane, AllDayToggle } from './all-day-lane';
import { CurrentTimeLine } from './current-time-line';
import { type DayEvents, focusKey, type GridFocus, nextFocus } from './grid-focus';
import { ALL_DAY_LANE_REM, DAY_HEADER_REM, gridStyle, MIN_EVENT_MINUTES, SLOT_MINUTES, SLOTS_PER_DAY, scrollToCurrentHour } from './grid-geometry';
import { TimeGridEvent } from './time-grid-event';

const SLOTS = Array.from({ length: SLOTS_PER_DAY }, (_, slot) => slot);
const FALLBACK_COLOR = 'var(--muted-foreground)';
/** Rows the all-day lane keeps when collapsed. */
const COLLAPSED_LANES = 2;

type TimeGridProps = {
	days: readonly Temporal.PlainDate[];
	timeZone: string;
	today: Temporal.PlainDate;
};

/**
 * Day or week time grid: hours down the side, one column per day, events placed by their local time.
 * It is an ARIA grid with one row per 30-minute slot. A single element is tabbable (roving focus); arrows move
 * between days and slots, and ↑/↓ also stop at each event that starts in a slot.
 */
export function TimeGrid({ days, timeZone, today }: TimeGridProps) {
	const { i18n, t } = useTranslation();
	const language = resolveLanguage([i18n.language]);
	const { data: settings } = useSettings();
	const { allDayCollapsed, timeFormat } = settings ?? DEFAULT_SETTINGS;
	const setAllDayCollapsed = useSetAllDayCollapsed();
	const { data: calendars } = useCalendars();
	const first = days[0];
	const last = days.at(-1);
	const { data: events } = useEvents(first && last ? daysToUtcRange(first, last, timeZone) : null);
	const [focus, setFocus] = useState<GridFocus | null>(null);

	const calendarById = new Map((calendars ?? []).map(calendar => [calendar.id, calendar]));
	const colorOf = (event: CalendarEvent) => calendarById.get(event.calendarId)?.color ?? FALLBACK_COLOR;
	// Hidden calendars stay out; all-day and day-long events go to the lane above the hours.
	const visible = (events ?? []).filter(event => calendarById.get(event.calendarId)?.isVisible !== false);
	const timed = visible.filter(event => !belongsInAllDayLane(event));
	const segmentsByDay: DaySegment<CalendarEvent>[][] = days.map(day => layoutDay(timed, day, timeZone, MIN_EVENT_MINUTES));

	const laneSegments = layoutWeek(visible.filter(belongsInAllDayLane), days, timeZone);
	const laneCount = Math.max(0, ...laneSegments.map(segment => segment.lane + 1));
	const collapsible = laneCount > COLLAPSED_LANES;
	const lanes = collapsible && allDayCollapsed ? COLLAPSED_LANES : laneCount;
	const lane = fitWeek(laneSegments, days.length, Math.max(lanes, 1));
	const headerRem = DAY_HEADER_REM + (lanes > 0 ? lanes * ALL_DAY_LANE_REM + 0.25 : 0);
	const allDayTitles = (column: number) => laneSegments.filter(segment => column >= segment.firstColumn && column < segment.firstColumn + segment.span).map(segment => segment.item.title);
	const dayEvents: DayEvents = segmentsByDay.map(segments =>
		segments
			.map(segment => ({ column: segment.column, id: segment.item.id, slot: Math.floor(segment.startMinute / SLOT_MINUTES), start: segment.startMinute }))
			.sort((a, b) => a.start - b.start || a.column - b.column)
	);

	const todayIndex = days.findIndex(day => day.equals(today));
	// Until the user moves focus, the tab stop is the current hour today, or 8:00 on the first day.
	const fallbackFocus: GridFocus =
		todayIndex === -1 ? { day: 0, eventId: null, slot: (8 * 60) / SLOT_MINUTES } : { day: todayIndex, eventId: null, slot: (Temporal.Now.zonedDateTimeISO(timeZone).hour * 60) / SLOT_MINUTES };
	// Focus kept from a previous range may point at a day or event that is no longer shown.
	const focusValid = focus !== null && focus.day < days.length && (focus.eventId === null || dayEvents[focus.day]?.some(event => event.id === focus.eventId));
	const activeKey = focusKey(focusValid ? focus : fallbackFocus);

	const instant = (day: Temporal.PlainDate, minute: number) =>
		new Date(day.toZonedDateTime({ plainTime: Temporal.PlainTime.from({ hour: Math.floor(minute / 60), minute: minute % 60 }), timeZone }).epochMilliseconds);
	const hourLabel = (slot: number) => formatTime(new Date(Date.UTC(2000, 0, 1, (slot * SLOT_MINUTES) / 60)), { language, timeFormat, timeZone: 'UTC' });

	const onFocus = (event: FocusEvent<HTMLDivElement>) => {
		const key = event.target instanceof HTMLElement ? event.target.dataset.focusKey : undefined;
		if (key === undefined) return;
		const [day, slot, eventId] = key.split(':');
		setFocus({ day: Number(day), eventId: eventId ?? null, slot: Number(slot) });
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const next = nextFocus(focusValid ? focus : fallbackFocus, event.key, event.ctrlKey || event.metaKey, dayEvents, days.length);
		if (next === null) return;
		event.preventDefault();
		// Every slot and event is already rendered; focusing it updates the state through `onFocus`.
		event.currentTarget.querySelector<HTMLElement>(`[data-focus-key="${focusKey(next)}"]`)?.focus();
	};

	return (
		<div className='h-full overflow-auto' data-time-zone={timeZone} ref={scrollToCurrentHour}>
			<div
				aria-colcount={days.length + 1}
				aria-label={t('calendar.grid')}
				aria-rowcount={SLOTS_PER_DAY + 1}
				className='relative grid'
				onFocus={onFocus}
				onKeyDown={onKeyDown}
				role='grid'
				style={gridStyle(days.length, headerRem)}
			>
				<div className='contents' role='row'>
					<div className='sticky top-0 left-0 z-30 border-b bg-background' role='columnheader'>
						{collapsible && <AllDayToggle collapsed={allDayCollapsed} onToggle={() => setAllDayCollapsed.mutate(!allDayCollapsed)} />}
					</div>
					{days.map((day, index) => {
						const isToday = index === todayIndex;
						const titles = allDayTitles(index);
						const date = formatDate(toUtcDate(day), { language, timeZone: 'UTC' });
						return (
							<div
								aria-current={isToday ? 'date' : undefined}
								aria-label={titles.length === 0 ? date : `${date}. ${t('calendar.allDay.events', { titles: titles.join(', ') })}`}
								className='sticky top-0 z-20 flex items-start justify-center gap-1.5 border-b border-l bg-background text-sm'
								key={day.toString()}
								role='columnheader'
							>
								<div className='flex items-center gap-1.5' style={{ height: `${DAY_HEADER_REM}rem` }}>
									<span className={cn('text-muted-foreground', isToday && 'font-medium text-foreground')}>{formatWeekday(toUtcDate(day), { language, timeZone: 'UTC' })}</span>
									{isToday ? <Badge>{day.day}</Badge> : <span className='font-medium'>{day.day}</span>}
								</div>
							</div>
						);
					})}
					{lanes > 0 && (
						<AllDayLane colorOf={colorOf} days={days} hiddenByColumn={lane.hiddenByColumn} lanes={lanes} onExpand={() => setAllDayCollapsed.mutate(false)} segments={lane.shown} />
					)}
				</div>
				{SLOTS.map(slot => {
					const onHour = slot % (60 / SLOT_MINUTES) === 0;
					return (
						<div className='contents' key={slot} role='row'>
							<div className='sticky left-0 z-10 bg-background pr-2 text-right text-[0.7rem] text-muted-foreground' role='rowheader'>
								{onHour ? <span className={cn('relative block', slot > 0 && '-top-2')}>{hourLabel(slot)}</span> : <span className='sr-only'>{hourLabel(slot)}</span>}
							</div>
							{days.map((day, dayIndex) => {
								const start = slot * SLOT_MINUTES;
								const key = focusKey({ day: dayIndex, eventId: null, slot });
								return (
									<div
										aria-label={`${formatDate(toUtcDate(day), { language, timeZone: 'UTC' })}, ${formatTimeRange(instant(day, start), instant(day, start + SLOT_MINUTES), { language, timeFormat, timeZone })}`}
										className={cn('border-l outline-none focus-visible:bg-accent', onHour ? 'border-t' : 'border-t border-t-border/40 border-dashed')}
										data-focus-key={key}
										key={day.toString()}
										role='gridcell'
										tabIndex={key === activeKey ? 0 : -1}
									>
										{segmentsByDay[dayIndex]
											?.filter(segment => Math.floor(segment.startMinute / SLOT_MINUTES) === slot)
											.map(segment => {
												const eventKey = focusKey({ day: dayIndex, eventId: segment.item.id, slot });
												return (
													<TimeGridEvent
														color={colorOf(segment.item)}
														dayCount={days.length}
														dayIndex={dayIndex}
														focusKey={eventKey}
														isActive={eventKey === activeKey}
														key={segment.item.id}
														segment={segment}
														timeLabel={formatTimeRange(segment.item.startAt, segment.item.endAt, { language, timeFormat, timeZone })}
													/>
												);
											})}
									</div>
								);
							})}
						</div>
					);
				})}
				{todayIndex !== -1 && <CurrentTimeLine dayCount={days.length} dayIndex={todayIndex} timeZone={timeZone} />}
			</div>
		</div>
	);
}
