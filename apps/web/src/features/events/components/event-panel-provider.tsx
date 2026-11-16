'use client';

import type { CalendarEvent } from '@tempi/core';
import { createContext, type ReactNode, use, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteEvent } from '../hooks/use-event-mutations';

/** A new event's starting point, as UTC instants (from a clicked slot or the `C` shortcut). */
export type EventDraft = { allDay: boolean; endAt: string; startAt: string };

/** What the right panel shows: a new event's form, or an existing event's detail (an editable form too). */
export type EventSelection = { draft: EventDraft; kind: 'new' } | { event: CalendarEvent; kind: 'event' } | null;

type EventPanel = {
	close: () => void;
	newEvent: (draft: EventDraft) => void;
	openEvent: (event: CalendarEvent) => void;
	/** Asks for confirmation, then deletes; closes the event's detail if it was open. */
	requestDelete: (event: CalendarEvent) => void;
	selection: EventSelection;
};

const EventPanelContext = createContext<EventPanel | null>(null);

/** Which event the right panel shows, shared by the grids (open, create), the panel and the shortcuts. */
export function EventPanelProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const [selection, setSelection] = useState<EventSelection>(null);
	const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null);
	const deleteEvent = useDeleteEvent();

	const confirmDelete = () => {
		if (pendingDelete === null) return;
		const { id } = pendingDelete;
		deleteEvent.mutate(id, { onSuccess: () => setSelection(current => (current?.kind === 'event' && current.event.id === id ? null : current)) });
		setPendingDelete(null);
	};

	const value: EventPanel = {
		close: () => setSelection(null),
		newEvent: draft => setSelection({ draft, kind: 'new' }),
		openEvent: event => setSelection({ event, kind: 'event' }),
		requestDelete: setPendingDelete,
		selection,
	};

	return (
		<EventPanelContext value={value}>
			{children}
			<AlertDialog onOpenChange={open => !open && setPendingDelete(null)} open={pendingDelete !== null}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('events.delete.title')}</AlertDialogTitle>
						<AlertDialogDescription>{t('events.delete.description', { title: pendingDelete?.title ?? '' })}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
						<AlertDialogAction onClick={confirmDelete} variant='destructive'>
							{t('actions.delete')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</EventPanelContext>
	);
}

export const useEventPanel = (): EventPanel => {
	const panel = use(EventPanelContext);
	if (panel === null) throw new Error('useEventPanel must be used inside EventPanelProvider');
	return panel;
};
