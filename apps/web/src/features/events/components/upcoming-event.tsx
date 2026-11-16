'use client';

import { DEFAULT_SETTINGS, type EventOccurrence, resolveLanguage } from '@tempi/core';
import { MapPinIcon, VideoIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { formatDate, formatRelativeMinutes, formatTimeRange } from '@/lib/date-format';
import { useShowEvent } from '../hooks/use-show-event';
import { useUpcomingEvent } from '../hooks/use-upcoming-event';

const MINUTE = 60_000;

/** The right panel's "up next" section: the event in progress or starting next, or an empty state. */
export function UpcomingEvent() {
	const { i18n, t } = useTranslation();
	const headingId = useId();
	const { event, isLoading, now } = useUpcomingEvent();
	const language = resolveLanguage([i18n.language]);

	let heading: string = t('upcoming.label');
	if (event !== null && now !== null) {
		const untilStart = (Date.parse(event.startAt) - now) / MINUTE;
		heading =
			untilStart > 0
				? t('upcoming.startsIn', { relative: formatRelativeMinutes(untilStart, language) })
				: t('upcoming.ongoing', { relative: formatRelativeMinutes((Date.parse(event.endAt) - now) / MINUTE, language) });
	}

	return (
		<section aria-labelledby={headingId} className='flex flex-col gap-3 text-xs'>
			<h2 className='font-heading text-sm font-semibold' id={headingId}>
				{heading}
			</h2>
			{event !== null ? <UpcomingCard event={event} /> : !isLoading && now !== null && <p className='text-muted-foreground'>{t('upcoming.empty')}</p>}
		</section>
	);
}

function UpcomingCard({ event }: { event: EventOccurrence }) {
	const { i18n, t } = useTranslation();
	const { timeZone, today } = useCalendarNavigation();
	const { data: settings } = useSettings();
	const { data: calendars } = useCalendars();
	const showEvent = useShowEvent();
	const color = calendars?.find(calendar => calendar.id === event.calendarId)?.color;

	const options = { language: resolveLanguage([i18n.language]), timeFormat: settings?.timeFormat ?? DEFAULT_SETTINGS.timeFormat, timeZone };
	const startDay = Temporal.Instant.from(event.startAt).toZonedDateTimeISO(timeZone).toPlainDate();
	const range = formatTimeRange(event.startAt, event.endAt, options);
	// Today's events need only their times; later ones also name the day.
	const when = today !== null && startDay.equals(today) ? range : `${formatDate(event.startAt, options, 'medium')} · ${range}`;

	return (
		<div className='flex flex-col gap-2 rounded-lg border p-3'>
			<button className='flex min-w-0 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30' onClick={() => showEvent(event)} type='button'>
				<span className='flex min-w-0 items-center gap-2'>
					<span aria-hidden='true' className='size-2 shrink-0 rounded-full' style={{ backgroundColor: color }} />
					<span className='truncate font-medium'>{event.title}</span>
				</span>
				<span className='text-muted-foreground'>{when}</span>
				{event.location !== null && (
					<span className='flex min-w-0 items-center gap-1 text-muted-foreground'>
						<MapPinIcon aria-hidden='true' className='size-3 shrink-0' />
						<span className='sr-only'>{t('upcoming.location')}</span>
						<span className='truncate'>{event.location}</span>
					</span>
				)}
			</button>
			{/* Core has validated the link. The desktop app opens new-window links with shell.openExternal. */}
			{event.videoUrl !== null && (
				<a className={buttonVariants({ size: 'sm' })} href={event.videoUrl} rel='noreferrer' target='_blank'>
					<VideoIcon data-icon='inline-start' />
					{t('events.join')}
				</a>
			)}
		</div>
	);
}
