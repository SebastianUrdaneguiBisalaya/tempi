'use client';

import type { EventOccurrence } from '@tempi/core';
import type { CalendarEvent } from '@usecalendar/core';
import { useCalendarContext, useCalendarLocale } from '@usecalendar/react';
import { CalendarIcon, MapPinIcon, TextIcon } from 'lucide-react';
import { type ComponentProps, type ReactElement, type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { JoinMeetingButton } from './join-meeting-button';

type EventPreviewProps = Omit<ComponentProps<typeof PopoverTrigger>, 'children' | 'render'> & {
	/** The event's own element (a button); it becomes the preview's trigger and keeps its props. */
	children: ReactElement;
	event: CalendarEvent<EventOccurrence>;
};

/**
 * A preview of an event's details while the mouse rests on it. Clicks belong to the event (they open the panel), so
 * only hovering opens it: a press closes it and keeps it closed until the pointer leaves, so drags and resizes stay
 * clear. Other props (e.g. from a context menu trigger wrapping it) are passed on to the event's element.
 */
export function EventPreview({ children, event, onPointerLeave, ...props }: EventPreviewProps) {
	const [open, setOpen] = useState(false);
	const pressed = useRef(false);

	return (
		<Popover
			onOpenChange={(next, details) => {
				if (details.reason === 'trigger-press') pressed.current = true;
				if (next && (details.reason !== 'trigger-hover' || pressed.current)) return;
				setOpen(next);
			}}
			open={open}
		>
			<PopoverTrigger
				{...props}
				delay={300}
				onPointerLeave={pointer => {
					pressed.current = false;
					onPointerLeave?.(pointer);
				}}
				openOnHover
				render={children}
			/>
			<PopoverContent align='start' className='w-72 gap-3' side='right' sideOffset={8}>
				{event.data === undefined ? null : <EventPreviewDetails event={event} occurrence={event.data} />}
			</PopoverContent>
		</Popover>
	);
}

function EventPreviewDetails({ event, occurrence }: { event: CalendarEvent<EventOccurrence>; occurrence: EventOccurrence }) {
	const { t } = useTranslation();
	const { formatters, locale, timeFormat } = useCalendarLocale();
	const { timeZone } = useCalendarContext();
	const { data: calendars } = useCalendars();
	const calendar = calendars?.find(item => item.id === occurrence.calendarId);

	return (
		<>
			<PopoverHeader className='flex-row items-start gap-2'>
				<span aria-hidden className='mt-1 size-2.5 shrink-0 rounded-full' style={{ backgroundColor: event.color }} />
				<div className='flex min-w-0 flex-col gap-1'>
					<PopoverTitle className='wrap-break-word'>{occurrence.title}</PopoverTitle>
					<PopoverDescription>{formatters.eventWhen(event, { locale, timeFormat, timeZone })}</PopoverDescription>
				</div>
			</PopoverHeader>
			<dl className='flex flex-col gap-2'>
				{calendar === undefined ? null : (
					<PreviewRow icon={<CalendarIcon />} label={t('events.form.calendar')}>
						{calendar.name}
					</PreviewRow>
				)}
				{occurrence.location ? (
					<PreviewRow icon={<MapPinIcon />} label={t('events.form.location')}>
						{occurrence.location}
					</PreviewRow>
				) : null}
				{occurrence.description ? (
					<PreviewRow icon={<TextIcon />} label={t('events.form.description')}>
						<span className='line-clamp-6 whitespace-pre-line'>{occurrence.description}</span>
					</PreviewRow>
				) : null}
			</dl>
			<JoinMeetingButton className='self-start' event={occurrence} />
		</>
	);
}

function PreviewRow({ children, icon, label }: { children: ReactNode; icon: ReactElement; label: string }) {
	return (
		<div className='flex items-start gap-2 [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'>
			{icon}
			<dt className='sr-only'>{label}</dt>
			<dd className='min-w-0 wrap-break-word'>{children}</dd>
		</div>
	);
}
