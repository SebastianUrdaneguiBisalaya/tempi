'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDialogShortcutScope, useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { fromLocalDate, toLocalDate } from '@/lib/plain-date';
import { useDayPickerOptions } from '../hooks/use-day-picker-options';
import { useCalendarNavigation } from './calendar-navigation-provider';

/** `.` opens a date picker; picking a day moves the calendar there. Arrows move between days and Enter picks one. */
export function GoToDateDialog() {
	const { t } = useTranslation();
	const { date, goToDate, today } = useCalendarNavigation();
	const dayPickerOptions = useDayPickerOptions();
	const [open, setOpen] = useState(false);
	useShortcut('goToDate', () => setOpen(true), { enabled: date !== null });
	useDialogShortcutScope(open);

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogContent className='w-auto'>
				<DialogHeader>
					<DialogTitle>{t('shell.sidebar.datePicker')}</DialogTitle>
				</DialogHeader>
				{date !== null && (
					<Calendar
						{...dayPickerOptions}
						// Focuses the current day, so the keyboard can pick another right away.
						autoFocus
						className='mx-auto p-0'
						defaultMonth={toLocalDate(date)}
						mode='single'
						onSelect={day => {
							goToDate(fromLocalDate(day));
							setOpen(false);
						}}
						required
						selected={toLocalDate(date)}
						today={today === null ? undefined : toLocalDate(today)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
