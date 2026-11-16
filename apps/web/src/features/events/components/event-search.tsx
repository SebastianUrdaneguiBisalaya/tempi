'use client';

import { DEFAULT_SETTINGS, type EventOccurrence, resolveLanguage } from '@tempi/core';
import { type ReactNode, useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { RightPanel } from '@/features/shell/components/right-panel';
import { formatDate, formatTimeRange } from '@/lib/date-format';
import { useEventSearch } from '../hooks/use-event-search';
import { useShowEvent } from '../hooks/use-show-event';

/**
 * The right panel with event search on top. While the field has text, the results replace the panel's sections;
 * arrows move through them and Enter shows the event. Esc clears the field.
 */
export function SearchablePanel({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const [query, setQuery] = useState('');
	// Typing stays responsive while the results for the latest text render.
	const searched = useDeferredValue(query);
	const searching = query.trim() !== '';

	return (
		<Command className='h-full rounded-none bg-transparent p-0' label={t('search.label')} shouldFilter={false}>
			<RightPanel
				search={
					<CommandInput
						aria-label={t('search.label')}
						className='w-full'
						onKeyDown={event => {
							if (event.key !== 'Escape' || query === '') return;
							// Handled here, so Esc doesn't also close something behind the field.
							event.preventDefault();
							setQuery('');
						}}
						onValueChange={setQuery}
						placeholder={t('search.placeholder')}
						value={query}
					/>
				}
			>
				{searching ? <SearchResults query={searched} /> : children}
			</RightPanel>
		</Command>
	);
}

function SearchResults({ query }: { query: string }) {
	const { t } = useTranslation();
	const { data: events, isPending } = useEventSearch(query);
	const { data: calendars } = useCalendars();
	const showEvent = useShowEvent();
	const calendarById = new Map(calendars?.map(calendar => [calendar.id, calendar]));
	// Like the grid: events of hidden calendars stay out of sight.
	const shown = (events ?? []).filter(event => calendarById.get(event.calendarId)?.isVisible !== false);

	return (
		<CommandList aria-label={t('search.results')} className='max-h-none'>
			{!isPending && <CommandEmpty>{t('search.empty')}</CommandEmpty>}
			{shown.map(event => (
				<CommandItem className='items-start' key={event.key} onSelect={() => showEvent(event)} value={event.key}>
					<span aria-hidden='true' className='mt-1.5 size-2 shrink-0 rounded-full' style={{ backgroundColor: calendarById.get(event.calendarId)?.color }} />
					<span className='flex min-w-0 flex-col'>
						<span className='truncate font-medium'>{event.title}</span>
						<EventWhen event={event} />
					</span>
				</CommandItem>
			))}
		</CommandList>
	);
}

function EventWhen({ event }: { event: EventOccurrence }) {
	const { i18n, t } = useTranslation();
	const { timeZone } = useCalendarNavigation();
	const { data: settings } = useSettings();
	// An all-day event's day is fixed in its own zone; a timed one shows in the zone the calendar shows.
	const options = { language: resolveLanguage([i18n.language]), timeFormat: settings?.timeFormat ?? DEFAULT_SETTINGS.timeFormat, timeZone: event.allDay ? event.timeZone : timeZone };
	const day = formatDate(event.startAt, options, 'medium');
	const when = event.allDay ? t('search.allDay', { day }) : `${day} · ${formatTimeRange(event.startAt, event.endAt, options)}`;
	return <span className='truncate text-muted-foreground'>{when}</span>;
}
