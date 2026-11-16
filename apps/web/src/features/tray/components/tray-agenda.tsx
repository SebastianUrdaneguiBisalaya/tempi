'use client';

import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_SETTINGS, daysToUtcRange, resolveLanguage } from '@tempi/core';
import { useEffect, useEffectEvent, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CalendarNavigationProvider, useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { isPast } from '@/features/calendar/components/event-style';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useDayPickerOptions } from '@/features/calendar/hooks/use-day-picker-options';
import { useEvents } from '@/features/calendar/hooks/use-events';
import { useMinute } from '@/features/calendar/hooks/use-minute';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { formatDate, formatTimeRange } from '@/lib/date-format';
import { fromLocalDate, toLocalDate } from '@/lib/plain-date';
import { cn } from '@/lib/utils';
import { useApi } from '@/providers/api-provider';
import { useShowInMainWindow } from '../hooks/use-show-in-main-window';

/** The menu bar calendar: a mini calendar and the picked day's events, today when it opens. */
export function TrayAgenda() {
	const { t } = useTranslation();
	const hasStorage = useApi() !== null;
	const { data: settings, isError } = useSettings();

	// Settings are local and load almost instantly; rendering nothing avoids a flash of the wrong content.
	if (hasStorage && settings === undefined && !isError) return null;
	if (settings?.onboardingCompleted === false) return <p className='p-4 text-sm text-muted-foreground'>{t('tray.setup')}</p>;
	return (
		<CalendarNavigationProvider>
			<TrayContent />
		</CalendarNavigationProvider>
	);
}

function TrayContent() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { date, goToDate, goToToday, today } = useCalendarNavigation();
	const dayPickerOptions = useDayPickerOptions();

	// The window is hidden between uses, not closed: each time it comes back, start on today with data refreshed from
	// what the main window changed meanwhile (events, but also the theme and language in the settings).
	const onShown = useEffectEvent(() => {
		goToToday();
		void queryClient.invalidateQueries();
	});
	useEffect(() => {
		const listener = () => onShown();
		window.addEventListener('focus', listener);
		return () => window.removeEventListener('focus', listener);
	}, []);

	// Today is unknown while prerendering.
	if (date === null || today === null) return null;

	return (
		<main className='flex h-svh flex-col bg-background'>
			<Calendar
				aria-label={t('shell.sidebar.datePicker')}
				className='mx-auto shrink-0 bg-transparent p-3 [--cell-size:--spacing(8)]'
				{...dayPickerOptions}
				mode='single'
				onSelect={day => goToDate(fromLocalDate(day))}
				// Keeps a day selected: picking the selected day again doesn't clear it.
				required
				selected={toLocalDate(date)}
				today={toLocalDate(today)}
			/>
			<Separator />
			<DayEvents day={date} />
		</main>
	);
}

function DayEvents({ day }: { day: Temporal.PlainDate }) {
	const { i18n, t } = useTranslation();
	const headingId = useId();
	const { timeZone, today } = useCalendarNavigation();
	const { data: settings } = useSettings();
	const { data: calendars } = useCalendars();
	const { data: events, isPending } = useEvents(daysToUtcRange(day, day, timeZone));
	const now = useMinute();
	const showInMainWindow = useShowInMainWindow();

	const calendarById = new Map(calendars?.map(calendar => [calendar.id, calendar]));
	// Like the grid: events of hidden calendars stay out of sight. All-day events first, as in the all-day lane.
	const shown = (events ?? []).filter(event => calendarById.get(event.calendarId)?.isVisible !== false).sort((a, b) => Number(b.allDay) - Number(a.allDay));
	const options = { language: resolveLanguage([i18n.language]), timeFormat: settings?.timeFormat ?? DEFAULT_SETTINGS.timeFormat, timeZone };
	const heading = today?.equals(day) ? t('shell.header.today') : formatDate(day.toZonedDateTime({ timeZone }).toInstant().toString(), options);

	return (
		<section aria-labelledby={headingId} className='flex min-h-0 flex-1 flex-col'>
			<h2 className='px-4 pt-3 pb-2 font-heading text-sm font-semibold' id={headingId}>
				{heading}
			</h2>
			<ScrollArea className='min-h-0 flex-1'>
				{!isPending && shown.length === 0 && <p className='px-4 pb-3 text-xs text-muted-foreground'>{t('tray.empty')}</p>}
				<ul aria-label={t('tray.events')} className='flex flex-col gap-0.5 px-2 pb-3'>
					{shown.map(event => (
						<li key={event.key}>
							<button
								className={cn(
									'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30',
									isPast(event, now) && 'text-muted-foreground'
								)}
								onClick={() => void showInMainWindow(event)}
								type='button'
							>
								<span aria-hidden='true' className='mt-1 size-2 shrink-0 rounded-full' style={{ backgroundColor: calendarById.get(event.calendarId)?.color }} />
								<span className='flex min-w-0 flex-col'>
									<span className='truncate font-medium'>{event.title}</span>
									<span className='text-muted-foreground'>{event.allDay ? t('tray.allDay') : formatTimeRange(event.startAt, event.endAt, options)}</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			</ScrollArea>
		</section>
	);
}
