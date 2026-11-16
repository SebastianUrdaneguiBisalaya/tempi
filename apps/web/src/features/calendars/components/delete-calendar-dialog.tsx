'use client';

import type { Calendar } from '@tempi/core';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDialogShortcutScope } from '@/features/shortcuts/hooks/use-shortcut';
import { useDeleteCalendar } from '../hooks/use-calendar-mutations';

type DeleteCalendarDialogProps = {
	/** The calendar to delete; null closes the dialog. */
	calendar: Calendar | null;
	calendars: readonly Calendar[];
	onClose: () => void;
};

/** Confirms deleting a calendar and asks what happens to its events: move them to another calendar, or delete them. */
export function DeleteCalendarDialog({ calendar, calendars, onClose }: DeleteCalendarDialogProps) {
	const { t } = useTranslation();
	const id = useId();
	const deleteCalendar = useDeleteCalendar();
	useDialogShortcutScope(calendar !== null);
	const targets = calendars.filter(other => other.id !== calendar?.id);
	const defaultTarget = targets.find(other => other.isDefault) ?? targets[0];
	// Kept per calendar: a new request starts from moving to the default.
	const [choice, setChoice] = useState<{ calendarId: string | null; mode: 'delete' | 'move'; target: string | null }>({ calendarId: null, mode: 'move', target: null });
	const current = choice.calendarId === (calendar?.id ?? null) ? choice : { calendarId: calendar?.id ?? null, mode: 'move' as const, target: null };
	const target = targets.find(other => other.id === current.target) ?? defaultTarget;
	const mode = target === undefined ? 'delete' : current.mode;
	const targetItems = targets.map(other => ({ color: other.color, label: other.name, value: other.id }));

	const confirm = () => {
		if (calendar === null) return;
		deleteCalendar.mutate({ id: calendar.id, moveEventsTo: mode === 'move' && target !== undefined ? target.id : null });
		onClose();
	};

	return (
		<AlertDialog onOpenChange={open => !open && onClose()} open={calendar !== null}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('calendars.delete.title', { name: calendar?.name ?? '' })}</AlertDialogTitle>
					<AlertDialogDescription>{t('calendars.delete.description')}</AlertDialogDescription>
				</AlertDialogHeader>
				<RadioGroup className='gap-3' onValueChange={value => setChoice({ ...current, mode: value === 'delete' ? 'delete' : 'move' })} value={mode}>
					{target !== undefined && (
						<div className='flex flex-wrap items-center gap-2'>
							<RadioGroupItem id={`${id}-move`} value='move' />
							<FieldLabel className='font-normal' htmlFor={`${id}-move`}>
								{t('calendars.delete.move')}
							</FieldLabel>
							<Select items={targetItems} onValueChange={value => typeof value === 'string' && setChoice({ ...current, mode: 'move', target: value })} value={target.id}>
								<SelectTrigger aria-label={t('calendars.delete.target')} className='min-w-36 flex-1' disabled={mode !== 'move'}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{targetItems.map(item => (
										<SelectItem key={item.value} value={item.value}>
											<span aria-hidden className='size-2.5 rounded-full' style={{ backgroundColor: item.color }} />
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					<div className='flex items-center gap-2'>
						<RadioGroupItem id={`${id}-delete`} value='delete' />
						<FieldLabel className='font-normal' htmlFor={`${id}-delete`}>
							{t('calendars.delete.events')}
						</FieldLabel>
					</div>
				</RadioGroup>
				<AlertDialogFooter>
					<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
					<AlertDialogAction onClick={confirm} variant='destructive'>
						{t('actions.delete')}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
