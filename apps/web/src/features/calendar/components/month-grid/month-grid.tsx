'use client';

import { type CalendarEvent, DEFAULT_SETTINGS, daysToUtcRange, fitWeek, isWeekend, layoutWeek, monthWeeks, resolveLanguage, type WeekSegment, weekNumber } from '@tempi/core';
import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { useEventPanel } from '@/features/events/components/event-panel-provider';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useElementHeight } from '@/hooks/use-element-height';
import { formatDate, formatTime, formatWeekday } from '@/lib/date-format';
import { toUtcDate } from '@/lib/plain-date';
import { cn } from '@/lib/utils';
import { useCalendars } from '../../hooks/use-calendars';
import { useEvents } from '../../hooks/use-events';
import { useCalendarNavigation } from '../calendar-navigation-provider';
import { EventChip } from '../event-chip';

// Pixel sizes: the number of event lanes per week is measured from the rendered row height.
const DAY_LABEL_PX = 28;
const LANE_PX = 22;
/** Below this the rows stop shrinking and the month scrolls; fits two lanes ("+N more" included). */
const MIN_ROW_PX = DAY_LABEL_PX + 2 * LANE_PX + 6;
const WEEK_NUMBER_COLUMN = '2rem';
const FALLBACK_COLOR = 'var(--muted-foreground)';

type MonthGridProps = {
	date: Temporal.PlainDate;
	timeZone: string;
	today: Temporal.PlainDate;
};

/**
 * Month view: whole weeks from the user's first weekday, events in lanes (multi-day ones spanning their days) and
 * "+N more" when a day has more than fits. An ARIA grid with roving focus over the days; Enter opens the day view.
 */
export function MonthGrid({ date, timeZone, today }: MonthGridProps) {
	const { i18n, t } = useTranslation();
	const language = resolveLanguage([i18n.language]);
	const { goToDate, setView } = useCalendarNavigation();
	const { openEvent } = useEventPanel();
	const { data: settings } = useSettings();
	const { weekStart, showWeekends, showWeekNumbers, timeFormat } = settings ?? DEFAULT_SETTINGS;
	const { data: calendars } = useCalendars();
	const { height, ref: bodyRef } = useElementHeight();
	const [focused, setFocused] = useState<string | null>(null);

	const allWeeks = monthWeeks(date, weekStart);
	const weeks = allWeeks.map(week => (showWeekends ? week : week.filter(day => !isWeekend(day))));
	const firstDay = allWeeks[0]?.[0] ?? date;
	const lastDay = allWeeks.at(-1)?.at(-1) ?? date;
	const { data: events } = useEvents(daysToUtcRange(firstDay, lastDay, timeZone));

	const calendarById = new Map((calendars ?? []).map(calendar => [calendar.id, calendar]));
	const shown = (events ?? []).filter(event => calendarById.get(event.calendarId)?.isVisible !== false);
	const colorOf = (event: CalendarEvent) => calendarById.get(event.calendarId)?.color ?? FALLBACK_COLOR;
	const timeOf = (event: CalendarEvent) => formatTime(event.startAt, { language, timeFormat, timeZone });

	const columnCount = weeks[0]?.length ?? 7;
	const rowHeight = Math.max(MIN_ROW_PX, height / weeks.length);
	const maxLanes = Math.max(1, Math.floor((rowHeight - DAY_LABEL_PX - 4) / LANE_PX));
	const columns = `${showWeekNumbers ? `${WEEK_NUMBER_COLUMN} ` : ''}repeat(${columnCount}, minmax(0, 1fr))`;
	const eventsLeft = showWeekNumbers ? WEEK_NUMBER_COLUMN : '0px';

	const allDays = weeks.flat();
	// Until the user moves focus, the tab stop is today when it's in this month, else the anchor date.
	const fallback = (allDays.some(day => day.equals(today)) && today.month === date.month ? today : date).toString();
	const activeDay = focused !== null && allDays.some(day => day.toString() === focused) ? focused : fallback;

	const openDay = (day: Temporal.PlainDate) => {
		goToDate(day);
		setView('day');
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		// Keys pressed inside a "+N more" popover (rendered in a portal, but bubbling through React) aren't grid moves.
		if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'gridcell') return;
		const row = weeks.findIndex(week => week.some(day => day.toString() === activeDay));
		const column = weeks[row]?.findIndex(day => day.toString() === activeDay) ?? -1;
		if (row === -1 || column === -1) return;
		const at = (nextRow: number, nextColumn: number) => weeks[nextRow]?.[nextColumn];
		const target = {
			ArrowDown: at(row + 1, column),
			ArrowLeft: at(row, column - 1),
			ArrowRight: at(row, column + 1),
			ArrowUp: at(row - 1, column),
			End: event.ctrlKey || event.metaKey ? at(weeks.length - 1, columnCount - 1) : at(row, columnCount - 1),
			Home: event.ctrlKey || event.metaKey ? at(0, 0) : at(row, 0),
		}[event.key];
		if (event.key === 'Enter' || event.key === ' ') {
			const day = at(row, column);
			if (day === undefined) return;
			event.preventDefault();
			openDay(day);
			return;
		}
		if (target === undefined) return;
		event.preventDefault();
		event.currentTarget.querySelector<HTMLElement>(`[data-day="${target.toString()}"]`)?.focus();
	};

	return (
		<div
			aria-label={t('calendar.grid')}
			className='flex h-full min-h-0 flex-col'
			onFocus={event => {
				if (event.target instanceof HTMLElement && event.target.dataset.day) setFocused(event.target.dataset.day);
			}}
			onKeyDown={onKeyDown}
			role='grid'
		>
			<div className='grid shrink-0 border-b' role='row' style={{ gridTemplateColumns: columns }}>
				{showWeekNumbers && (
					<div className='py-1.5 text-center text-[0.7rem] text-muted-foreground' role='columnheader'>
						<span className='sr-only'>{t('calendar.month.weekNumber')}</span>
					</div>
				)}
				{(weeks[0] ?? []).map(day => (
					<div className='py-1.5 text-center text-xs text-muted-foreground' key={day.dayOfWeek} role='columnheader'>
						{formatWeekday(toUtcDate(day), { language, timeZone: 'UTC' })}
					</div>
				))}
			</div>
			<div className='grid min-h-0 flex-1 overflow-y-auto' ref={bodyRef} style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(${MIN_ROW_PX}px, 1fr))` }}>
				{weeks.map(week => {
					const segments = layoutWeek(shown, week, timeZone);
					const { hiddenByColumn, shown: fitted } = fitWeek(segments, week.length, maxLanes);
					const weekKey = week[0]?.toString() ?? '';
					return (
						<div className='relative grid border-b last:border-b-0' key={weekKey} role='row' style={{ gridTemplateColumns: columns }}>
							{showWeekNumbers && week[0] && (
								<div className='pt-1.5 text-center text-[0.7rem] text-muted-foreground' role='rowheader'>
									<span aria-hidden>{weekNumber(week[0], weekStart)}</span>
									<span className='sr-only'>{t('calendar.month.week', { number: weekNumber(week[0], weekStart) })}</span>
								</div>
							)}
							{week.map((day, column) => {
								const key = day.toString();
								const isToday = day.equals(today);
								const isOutside = day.month !== date.month;
								const daySegments = segments.filter(segment => column >= segment.firstColumn && column < segment.firstColumn + segment.span);
								const hidden = hiddenByColumn[column] ?? 0;
								return (
									<div
										aria-current={isToday ? 'date' : undefined}
										aria-label={[formatDate(toUtcDate(day), { language, timeZone: 'UTC' }), ...daySegments.map(segment => segment.item.title)].join('. ')}
										className={cn(
											'relative min-w-0 cursor-pointer border-l outline-none first:border-l-0 focus-visible:bg-accent',
											isOutside && 'bg-muted/40 text-muted-foreground'
										)}
										data-day={key}
										key={key}
										onClick={() => openDay(day)}
										role='gridcell'
										tabIndex={key === activeDay ? 0 : -1}
									>
										<div className='flex justify-center pt-1' style={{ height: DAY_LABEL_PX }}>
											<span className={cn('flex size-6 items-center justify-center rounded-full text-xs', isToday && 'bg-primary font-medium text-primary-foreground')}>
												{day.day}
											</span>
										</div>
										{hidden > 0 && (
											<Popover>
												<PopoverTrigger
													className='absolute inset-x-0.5 truncate rounded-sm px-1 text-left text-[0.7rem] font-medium text-muted-foreground hover:bg-accent'
													onClick={event => event.stopPropagation()}
													style={{ height: LANE_PX - 2, top: DAY_LABEL_PX + (maxLanes - 1) * LANE_PX }}
													tabIndex={-1}
												>
													{t('calendar.month.more', { count: hidden })}
												</PopoverTrigger>
												<PopoverContent className='w-64' onClick={event => event.stopPropagation()}>
													<PopoverHeader>
														<PopoverTitle>{formatDate(toUtcDate(day), { language, timeZone: 'UTC' })}</PopoverTitle>
													</PopoverHeader>
													<ul className='flex flex-col gap-0.5'>
														{daySegments.map(segment => (
															<li key={segment.item.id} style={{ height: LANE_PX - 2 }}>
																<button className='block size-full rounded-sm text-left hover:bg-accent' onClick={() => openEvent(segment.item)} type='button'>
																	<EventChip
																		color={colorOf(segment.item)}
																		segment={{ ...segment, continuesAfter: false, continuesBefore: false, span: 1 }}
																		time={timeOf(segment.item)}
																	/>
																</button>
															</li>
														))}
													</ul>
												</PopoverContent>
											</Popover>
										)}
									</div>
								);
							})}
							{/* Event bars sit over the day cells so multi-day events can span them; a bar opens its event, the gaps open the day. */}
							<div aria-hidden className='pointer-events-none absolute inset-y-0 right-0' style={{ left: eventsLeft }}>
								{fitted.map((segment: WeekSegment<CalendarEvent>) => (
									<button
										className='pointer-events-auto absolute px-0.5 text-left'
										key={segment.item.id}
										onClick={event => {
											event.stopPropagation();
											openEvent(segment.item);
										}}
										style={{
											height: LANE_PX - 2,
											left: `${(segment.firstColumn / week.length) * 100}%`,
											top: DAY_LABEL_PX + segment.lane * LANE_PX,
											width: `${(segment.span / week.length) * 100}%`,
										}}
										// Keyboard users reach events through the day: Enter opens the day view.
										tabIndex={-1}
										type='button'
									>
										<EventChip color={colorOf(segment.item)} segment={segment} time={timeOf(segment.item)} />
									</button>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
