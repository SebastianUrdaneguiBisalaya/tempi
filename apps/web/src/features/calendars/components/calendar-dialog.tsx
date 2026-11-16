'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Calendar, newCalendarInputSchema, zodErrorKeyMap } from '@tempi/core';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormFieldError } from '@/components/form-field-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useCreateCalendar, useUpdateCalendar } from '../hooks/use-calendar-mutations';
import { ColorField } from './color-field';

// The fields this dialog edits, with core's rules and messages.
const calendarFormSchema = newCalendarInputSchema.pick({ color: true, name: true });
type CalendarFormValues = z.input<typeof calendarFormSchema>;

const isFormField = (field: string): field is keyof CalendarFormValues => field === 'color' || field === 'name';

type CalendarDialogProps = {
	/** The calendar to edit, or null to create one. */
	calendar: Calendar | null;
	/** Starting color for a new calendar. */
	defaultColor: string;
	onClose: () => void;
	open: boolean;
};

/** Creates or edits a calendar: its name and color. */
export function CalendarDialog({ calendar, defaultColor, onClose, open }: CalendarDialogProps) {
	const { t } = useTranslation();
	return (
		<Dialog onOpenChange={next => !next && onClose()} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t(calendar === null ? 'calendars.add' : 'calendars.edit')}</DialogTitle>
				</DialogHeader>
				{/* Remount per calendar so the form starts from its values. */}
				{open && <CalendarForm calendar={calendar} defaultColor={defaultColor} key={calendar?.id ?? 'new'} onDone={onClose} />}
			</DialogContent>
		</Dialog>
	);
}

function CalendarForm({ calendar, defaultColor, onDone }: { calendar: Calendar | null; defaultColor: string; onDone: () => void }) {
	const { t } = useTranslation();
	const id = useId();
	const createCalendar = useCreateCalendar();
	const updateCalendar = useUpdateCalendar();
	const { control, handleSubmit, setError } = useForm<CalendarFormValues, unknown, z.output<typeof calendarFormSchema>>({
		defaultValues: { color: calendar?.color ?? defaultColor, name: calendar?.name ?? '' },
		resolver: zodResolver(calendarFormSchema, { error: zodErrorKeyMap }),
	});

	const showFieldErrors = (error: { issues: readonly { field?: string; key: string }[] }) => {
		for (const issue of error.issues) if (issue.field !== undefined && isFormField(issue.field)) setError(issue.field, { message: issue.key });
	};

	const submit = handleSubmit(values => {
		if (calendar === null) createCalendar.mutate(values, { onError: showFieldErrors, onSuccess: onDone });
		else updateCalendar.mutate({ id: calendar.id, patch: values }, { onError: showFieldErrors, onSuccess: onDone });
	});

	return (
		<form className='flex flex-col gap-4' noValidate onSubmit={submit}>
			<FieldGroup className='gap-3'>
				<Controller
					control={control}
					name='name'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-name`}>{t('calendars.name')}</FieldLabel>
							<Input aria-invalid={fieldState.invalid || undefined} autoFocus id={`${id}-name`} {...field} />
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				<Controller
					control={control}
					name='color'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel id={`${id}-color`}>{t('calendars.color')}</FieldLabel>
							<ColorField labelledBy={`${id}-color`} onChange={field.onChange} value={field.value} />
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
			</FieldGroup>
			<DialogFooter>
				<Button onClick={onDone} type='button' variant='outline'>
					{t('actions.cancel')}
				</Button>
				<Button disabled={createCalendar.isPending || updateCalendar.isPending} type='submit'>
					{t(calendar === null ? 'actions.create' : 'actions.save')}
				</Button>
			</DialogFooter>
		</form>
	);
}
