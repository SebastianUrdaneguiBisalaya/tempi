'use client';

import type { EventOccurrence, OccurrenceScope } from '@tempi/core';
import { createContext, type ReactNode, use, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteEvent, useDeleteOccurrence } from '../hooks/use-event-mutations';
import { OccurrenceScopeDialog, type ScopeRequest } from './occurrence-scope-dialog';

/** A new event's starting point, as UTC instants (from a clicked slot or the `C` shortcut). */
export type EventDraft = { allDay: boolean; endAt: string; startAt: string };

/** What the right panel shows: a new event's form, or an existing event's detail (an editable form too). */
export type EventSelection = { draft: EventDraft; kind: 'new' } | { event: EventOccurrence; kind: 'event' } | null;

type EventPanel = {
	/** For an occurrence of a recurring event: asks how far a change reaches. Null when cancelled. */
	chooseScope: (request: ScopeRequest) => Promise<OccurrenceScope | null>;
	close: () => void;
	newEvent: (draft: EventDraft) => void;
	openEvent: (event: EventOccurrence) => void;
	/** Shows an occurrence's saved changes if `previousKey` is the open one, so its form doesn't hold stale values. */
	refreshEvent: (previousKey: string, event: EventOccurrence) => void;
	/** Asks for confirmation (and, for a recurring event, which occurrences), then deletes; closes the detail if it was open. */
	requestDelete: (event: EventOccurrence) => void;
	selection: EventSelection;
};

const EventPanelContext = createContext<EventPanel | null>(null);

/** Which event the right panel shows, shared by the grids (open, create), the panel and the shortcuts. */
export function EventPanelProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const [selection, setSelection] = useState<EventSelection>(null);
	const [pendingDelete, setPendingDelete] = useState<EventOccurrence | null>(null);
	const [scopeRequest, setScopeRequest] = useState<ScopeRequest | null>(null);
	// The open scope dialog's answer goes to whoever asked; a new request cancels an unanswered one.
	const resolveScope = useRef<((scope: OccurrenceScope | null) => void) | null>(null);
	const deleteEvent = useDeleteEvent();
	const deleteOccurrence = useDeleteOccurrence();

	const closeIfOpen = (key: string) => setSelection(current => (current?.kind === 'event' && current.event.key === key ? null : current));

	const chooseScope = (request: ScopeRequest) =>
		new Promise<OccurrenceScope | null>(resolve => {
			resolveScope.current?.(null);
			resolveScope.current = resolve;
			setScopeRequest(request);
		});

	const answerScope = (scope: OccurrenceScope | null) => {
		resolveScope.current?.(scope);
		resolveScope.current = null;
		setScopeRequest(null);
	};

	const confirmDelete = () => {
		if (pendingDelete === null) return;
		const { id, key } = pendingDelete;
		deleteEvent.mutate(id, { onSuccess: () => closeIfOpen(key) });
		setPendingDelete(null);
	};

	const requestDelete = async (event: EventOccurrence) => {
		const { series } = event;
		if (series === null) {
			setPendingDelete(event);
			return;
		}
		// Choosing which occurrences to delete is the confirmation.
		const scope = await chooseScope({ action: 'delete', allowThis: true, title: event.title });
		if (scope !== null) deleteOccurrence.mutate({ scope, series }, { onSuccess: () => closeIfOpen(event.key) });
	};

	const value: EventPanel = {
		chooseScope,
		close: () => setSelection(null),
		newEvent: draft => setSelection({ draft, kind: 'new' }),
		openEvent: event => setSelection({ event, kind: 'event' }),
		refreshEvent: (previousKey, event) => setSelection(current => (current?.kind === 'event' && current.event.key === previousKey ? { event, kind: 'event' } : current)),
		requestDelete: event => void requestDelete(event),
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
			<OccurrenceScopeDialog onClose={answerScope} request={scopeRequest} />
		</EventPanelContext>
	);
}

export const useEventPanel = (): EventPanel => {
	const panel = use(EventPanelContext);
	if (panel === null) throw new Error('useEventPanel must be used inside EventPanelProvider');
	return panel;
};
