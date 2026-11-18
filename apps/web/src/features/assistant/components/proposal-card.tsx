'use client';

import { type AssistantProposal, asOccurrence, type DomainError } from '@tempi/core';
import { issueTranslation } from '@tempi/i18n';
import { CalendarPlusIcon, CheckIcon, PencilIcon, PencilLineIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Spinner } from '@/components/ui/spinner';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useEventPanel } from '@/features/events/components/event-panel-provider';
import { useCreateEvent, useUpdateEvent } from '@/features/events/hooks/use-event-mutations';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { formatDate, formatTimeRange } from '@/lib/date-format';
import { type EventFormValues, eventToFormValues } from '@/lib/event-form-values';
import type { ProposalItem } from '../assistant-store';

type EventFields = Extract<AssistantProposal, { kind: 'create' }>['input'];

const ICONS = { create: CalendarPlusIcon, delete: Trash2Icon, update: PencilLineIcon } as const;

/** Form values that differ between the stored event and the proposal, so the form opens with only those changed. */
const changedValues = (before: EventFormValues, after: EventFormValues): Partial<EventFormValues> =>
	Object.fromEntries(Object.entries(after).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key as keyof EventFormValues])));

/** The fields of the event a proposal would leave: the new event, the edited one, or the one to delete. */
const resultingEvent = (proposal: AssistantProposal): EventFields =>
	proposal.kind === 'create' ? proposal.input : proposal.kind === 'update' ? { ...proposal.event, ...proposal.patch } : proposal.event;

type ProposalCardProps = {
	item: ProposalItem;
	/** Records that the user confirmed it, so the conversation (and the model) knows. */
	onConfirmed: () => void;
	/** Called before opening the event form, e.g. to collapse the panel on narrow windows. */
	onEdit: () => void;
	/** Records that the user turned it down; offered only where given (the Voice tab). */
	onCancel?: () => void;
};

/** A change the assistant suggests. Confirm runs the same mutations as the event form; Edit opens the form prefilled. */
export function ProposalCard({ item, onCancel, onConfirmed, onEdit }: ProposalCardProps) {
	const { t } = useTranslation();
	const { proposal, status } = item;
	const { data: calendars } = useCalendars();
	const { data: settings } = useSettings();
	const { newEvent, openEvent, requestDelete, reviewChanges } = useEventPanel();
	const createEvent = useCreateEvent();
	const updateEvent = useUpdateEvent();
	const [error, setError] = useState<DomainError | null>(null);
	const pending = createEvent.isPending || updateEvent.isPending;

	const event = resultingEvent(proposal);
	const calendar = calendars?.find(candidate => candidate.id === event.calendarId);
	const options = { language: settings?.language ?? 'en', timeFormat: settings?.timeFormat ?? '24h', timeZone: event.timeZone };
	const when = event.allDay ? formatDate(event.startAt, options, 'medium') : formatTimeRange(event.startAt, event.endAt, options);
	const Icon = ICONS[proposal.kind];

	const confirm = () => {
		setError(null);
		if (proposal.kind === 'create') createEvent.mutate(proposal.input, { onError: setError, onSuccess: onConfirmed });
		else if (proposal.kind === 'update') updateEvent.mutate({ id: proposal.id, patch: proposal.patch }, { onError: setError, onSuccess: onConfirmed });
		// The usual confirmation dialog (or, for a recurring event, the scope dialog) asks first.
		else requestDelete(asOccurrence(proposal.event), onConfirmed);
	};

	const edit = () => {
		onEdit();
		if (proposal.kind === 'create') {
			const { allDay, endAt, startAt } = proposal.input;
			newEvent({ allDay, endAt, startAt, values: eventToFormValues(proposal.input) });
		} else if (proposal.kind === 'update') {
			reviewChanges(asOccurrence(proposal.event), changedValues(eventToFormValues(proposal.event), eventToFormValues({ ...proposal.event, ...proposal.patch })));
		} else openEvent(asOccurrence(proposal.event));
	};

	return (
		// The card's border is a ring drawn outside its box; the chat's list items clip their paint (`content-visibility`),
		// so an inset ring keeps all four sides visible there and in the Voice tab alike.
		<Card className='w-full ring-inset' size='sm'>
			<CardHeader>
				<CardTitle className='flex items-center gap-2'>
					<Icon aria-hidden className='size-3.5 text-muted-foreground' />
					{t(`assistant.proposal.${proposal.kind}`)}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1'>
					<dt className='text-muted-foreground'>{t('assistant.proposal.title')}</dt>
					<dd className={proposal.kind === 'delete' ? 'font-medium line-through' : 'font-medium'}>{event.title}</dd>
					<dt className='text-muted-foreground'>{t('assistant.proposal.when')}</dt>
					<dd>{when}</dd>
					{calendar !== undefined && (
						<>
							<dt className='text-muted-foreground'>{t('assistant.proposal.calendar')}</dt>
							<dd className='flex items-center gap-1.5'>
								<span aria-hidden className='size-2 shrink-0 rounded-full' style={{ backgroundColor: calendar.color }} />
								{calendar.name}
							</dd>
						</>
					)}
					{event.location !== null && (
						<>
							<dt className='text-muted-foreground'>{t('assistant.proposal.location')}</dt>
							<dd className='break-words'>{event.location}</dd>
						</>
					)}
				</dl>
				{error?.issues.map(issue => {
					const { key, options: params } = issueTranslation(issue);
					return (
						<p className='mt-2 text-destructive' key={`${issue.key}:${issue.field ?? ''}`} role='alert'>
							{/* A `defaultValue` selects i18next's untyped overload, since the key is only known at runtime. */}
							{t(key, { ...params, defaultValue: t('system.unexpected', { ns: 'errors' }) })}
						</p>
					);
				})}
			</CardContent>
			<CardFooter className='gap-2'>
				{status === 'confirmed' ? (
					<Marker>
						<MarkerIcon>
							<CheckIcon />
						</MarkerIcon>
						<MarkerContent>{t(proposal.kind === 'delete' ? 'assistant.proposal.deleted' : 'assistant.proposal.saved')}</MarkerContent>
					</Marker>
				) : status === 'canceled' ? (
					<Marker>
						<MarkerIcon>
							<XIcon />
						</MarkerIcon>
						<MarkerContent>{t('assistant.proposal.canceled')}</MarkerContent>
					</Marker>
				) : (
					<>
						<Button disabled={pending} onClick={confirm} size='sm' variant={proposal.kind === 'delete' ? 'destructive' : 'default'}>
							{pending && <Spinner data-icon='inline-start' />}
							{t('assistant.proposal.confirm')}
						</Button>
						<Button disabled={pending} onClick={edit} size='sm' variant='outline'>
							<PencilIcon data-icon='inline-start' />
							{t(proposal.kind === 'delete' ? 'assistant.proposal.open' : 'assistant.proposal.edit')}
						</Button>
						{onCancel !== undefined && (
							<Button disabled={pending} onClick={onCancel} size='sm' variant='ghost'>
								{t('assistant.proposal.cancel')}
							</Button>
						)}
					</>
				)}
			</CardFooter>
		</Card>
	);
}
