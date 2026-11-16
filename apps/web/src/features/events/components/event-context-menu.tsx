'use client';

import type { EventOccurrence } from '@tempi/core';
import { CalendarIcon, CopyIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import type { KeyboardEvent, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useChangeEventCalendar, useDuplicateEvent } from '../hooks/use-event-mutations';
import { useEventPanel } from './event-panel-provider';

/** Shift+F10 and the Menu key open an element's context menu; macOS has neither natively, so both are handled here. */
const isMenuKey = (event: KeyboardEvent) => event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);

/** Opens the menu below a focused element, as a right-click there would. */
const openFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
	if (!isMenuKey(event)) return;
	event.preventDefault();
	const box = event.currentTarget.getBoundingClientRect();
	event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + 8, clientY: box.bottom }));
};

type EventContextMenuProps = {
	/** The event's own element (a button); it becomes the menu's trigger and keeps its props. */
	children: ReactElement;
	event: EventOccurrence;
};

/** Right-click (or Shift+F10 / the Menu key) actions on an event: edit, duplicate, change calendar, delete. */
export function EventContextMenu({ children, event }: EventContextMenuProps) {
	const { t } = useTranslation();
	const { chooseScope, openEvent, refreshEvent, requestDelete } = useEventPanel();
	const { data: calendars } = useCalendars();
	const duplicate = useDuplicateEvent();
	const changeCalendar = useChangeEventCalendar();

	const moveTo = async (calendarId: string) => {
		if (calendarId === event.calendarId) return;
		const scope = event.series === null ? undefined : await chooseScope({ action: 'edit', allowThis: true, title: event.title });
		if (scope === null) return;
		changeCalendar.mutate({ calendarId, occurrence: event, scope }, { onSuccess: saved => refreshEvent(event.key, saved) });
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger aria-haspopup='menu' onKeyDown={openFromKeyboard} render={children} />
			<ContextMenuContent aria-label={t('events.menu.label')}>
				<ContextMenuItem onClick={() => openEvent(event)}>
					<PencilIcon />
					{t('actions.edit')}
				</ContextMenuItem>
				<ContextMenuItem onClick={() => duplicate.mutate(event.series?.id ?? event.id, { onSuccess: openEvent })}>
					<CopyIcon />
					{t('actions.duplicate')}
				</ContextMenuItem>
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<CalendarIcon />
						{t('events.menu.calendar')}
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuRadioGroup onValueChange={value => typeof value === 'string' && void moveTo(value)} value={event.calendarId}>
							{(calendars ?? []).map(calendar => (
								<ContextMenuRadioItem key={calendar.id} value={calendar.id}>
									<span aria-hidden className='size-2.5 rounded-full' style={{ backgroundColor: calendar.color }} />
									{calendar.name}
								</ContextMenuRadioItem>
							))}
						</ContextMenuRadioGroup>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={() => requestDelete(event)} variant='destructive'>
					<Trash2Icon />
					{t('actions.delete')}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
