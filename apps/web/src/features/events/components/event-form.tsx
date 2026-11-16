'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Calendar, type CalendarEvent, zodErrorKeyMap } from '@tempi/core';
import { Trash2Icon, XIcon } from 'lucide-react';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormFieldError } from '@/components/form-field-error';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { convertFormTimes, type EventFormValues, eventFormSchema } from '@/lib/event-form-values';
import { useCreateEvent, useUpdateEvent } from '../hooks/use-event-mutations';
import { useEventPanel } from './event-panel-provider';
import { TimeZoneCombobox } from './time-zone-combobox';

type EventFormOutput = z.output<typeof eventFormSchema>;

const isFormField = (values: EventFormValues, field: string): field is keyof EventFormValues => Object.hasOwn(values, field);

/** Reminder choices in minutes before the start; null is no reminder. */
const REMINDERS = [null, 0, 5, 10, 15, 30, 60, 1440] as const;

type EventFormProps = {
	calendars: readonly Calendar[];
	defaultValues: EventFormValues;
	/** The stored event being edited, or null for a new one. */
	event: CalendarEvent | null;
};

/**
 * The event detail is this form, editable in place: a new event shows Create, an existing one shows Save and
 * Discard once something changed, and Delete. Every rule comes from core's event schema.
 */
export function EventForm({ calendars, defaultValues, event }: EventFormProps) {
	const { t } = useTranslation();
	const id = useId();
	const { close, openEvent, requestDelete } = useEventPanel();
	const createEvent = useCreateEvent();
	const updateEvent = useUpdateEvent();
	const form = useForm<EventFormValues, unknown, EventFormOutput>({ defaultValues, resolver: zodResolver(eventFormSchema, { error: zodErrorKeyMap }) });
	const { control, formState, getValues, handleSubmit, reset, setError, setValue, watch } = form;
	const allDay = watch('allDay');
	const pending = createEvent.isPending || updateEvent.isPending;

	// Issues the backend ties to a field show under it; the rest go to the error toast (`handlesFieldErrors`).
	const showFieldErrors = (error: { issues: readonly { field?: string; key: string }[] }) => {
		for (const issue of error.issues) {
			if (issue.field !== undefined && isFormField(defaultValues, issue.field)) setError(issue.field, { message: issue.key });
		}
	};

	const submit = handleSubmit(values => {
		if (event === null) {
			createEvent.mutate(values, { onError: showFieldErrors, onSuccess: openEvent });
			return;
		}
		// The form doesn't edit recurrence, status or the video link, so the update leaves them as they are.
		const { rrule: _rrule, status: _status, videoUrl: _videoUrl, ...patch } = values;
		updateEvent.mutate({ id: event.id, patch }, { onError: showFieldErrors, onSuccess: openEvent });
	});

	const toggleAllDay = (checked: boolean) => {
		const times = convertFormTimes(getValues(), checked);
		setValue('allDay', checked, { shouldDirty: true });
		setValue('startAt', times.startAt, { shouldDirty: true });
		setValue('endAt', times.endAt, { shouldDirty: true });
	};

	const calendarItems = calendars.map(calendar => ({ color: calendar.color, label: calendar.name, value: calendar.id }));
	const reminderLabel = (minutes: number | null) => {
		if (minutes === null) return t('events.reminders.none');
		if (minutes === 0) return t('events.reminders.atStart');
		if (minutes === 60) return t('events.reminders.hour');
		if (minutes === 1440) return t('events.reminders.day');
		return t('events.reminders.minutes', { count: minutes });
	};
	const reminderItems = REMINDERS.map(minutes => ({ label: reminderLabel(minutes), value: minutes === null ? 'none' : String(minutes) }));
	const timeType = allDay ? 'date' : 'datetime-local';

	return (
		<form className='flex h-full min-h-0 flex-col' noValidate onSubmit={submit}>
			<div className='flex items-center justify-between gap-2 border-b px-3 py-2'>
				<h2 className='truncate font-heading text-sm font-semibold'>{event === null ? t('events.newEvent') : event.title}</h2>
				<Button aria-label={t('actions.close')} onClick={close} size='icon-sm' type='button' variant='ghost'>
					<XIcon />
				</Button>
			</div>
			<FieldGroup className='min-h-0 flex-1 gap-3 overflow-y-auto p-3'>
				<Controller
					control={control}
					name='title'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-title`}>{t('events.form.title')}</FieldLabel>
							<Input
								aria-invalid={fieldState.invalid || undefined}
								// A new event is created to be named: start typing right away.
								autoFocus={event === null}
								id={`${id}-title`}
								placeholder={t('events.form.titlePlaceholder')}
								{...field}
							/>
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				<Controller
					control={control}
					name='allDay'
					render={({ field }) => (
						<Field orientation='horizontal'>
							<Switch checked={field.value} id={`${id}-all-day`} onCheckedChange={toggleAllDay} ref={field.ref} />
							<FieldLabel htmlFor={`${id}-all-day`}>{t('events.form.allDay')}</FieldLabel>
						</Field>
					)}
				/>
				<div className='grid gap-3 sm:grid-cols-2'>
					{(['startAt', 'endAt'] as const).map(name => (
						<Controller
							control={control}
							key={name}
							name={name}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor={`${id}-${name}`}>{t(name === 'startAt' ? 'events.form.start' : 'events.form.end')}</FieldLabel>
									<Input aria-invalid={fieldState.invalid || undefined} id={`${id}-${name}`} type={timeType} {...field} />
									<FormFieldError error={fieldState.error} />
								</Field>
							)}
						/>
					))}
				</div>
				<Controller
					control={control}
					name='timeZone'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-time-zone`}>{t('events.form.timeZone')}</FieldLabel>
							<TimeZoneCombobox id={`${id}-time-zone`} invalid={fieldState.invalid} onChange={field.onChange} ref={field.ref} value={field.value} />
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				<Controller
					control={control}
					name='calendarId'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-calendar`}>{t('events.form.calendar')}</FieldLabel>
							<Select items={calendarItems} onValueChange={value => value !== null && field.onChange(value)} value={field.value}>
								<SelectTrigger aria-invalid={fieldState.invalid || undefined} className='w-full' id={`${id}-calendar`} ref={field.ref}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{calendarItems.map(item => (
										<SelectItem key={item.value} value={item.value}>
											<span aria-hidden className='size-2.5 rounded-full' style={{ backgroundColor: item.color }} />
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				<Controller
					control={control}
					name='location'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-location`}>{t('events.form.location')}</FieldLabel>
							<Input aria-invalid={fieldState.invalid || undefined} id={`${id}-location`} {...field} />
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				<Controller
					control={control}
					name='reminderMinutes'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-reminder`}>{t('events.form.reminder')}</FieldLabel>
							<Select
								items={reminderItems}
								onValueChange={value => field.onChange(value === null || value === 'none' ? null : Number(value))}
								value={field.value === null ? 'none' : String(field.value)}
							>
								<SelectTrigger aria-invalid={fieldState.invalid || undefined} className='w-full' id={`${id}-reminder`} ref={field.ref}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{reminderItems.map(item => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				<Controller
					control={control}
					name='description'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-description`}>{t('events.form.description')}</FieldLabel>
							<Textarea aria-invalid={fieldState.invalid || undefined} id={`${id}-description`} rows={4} {...field} />
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
			</FieldGroup>
			<div className='flex flex-wrap items-center gap-2 border-t px-3 py-2'>
				{event !== null && (
					<Button onClick={() => requestDelete(event)} type='button' variant='ghost'>
						<Trash2Icon data-icon='inline-start' />
						{t('actions.delete')}
					</Button>
				)}
				<div className='ml-auto flex gap-2'>
					{event === null ? (
						<>
							<Button onClick={close} type='button' variant='outline'>
								{t('actions.cancel')}
							</Button>
							<Button disabled={pending} type='submit'>
								{t('actions.create')}
							</Button>
						</>
					) : (
						formState.isDirty && (
							<>
								<Button onClick={() => reset()} type='button' variant='outline'>
									{t('actions.discard')}
								</Button>
								<Button disabled={pending} type='submit'>
									{t('actions.save')}
								</Button>
							</>
						)
					)}
				</div>
			</div>
		</form>
	);
}
