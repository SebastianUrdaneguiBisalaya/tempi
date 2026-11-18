'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { asOccurrence, type Calendar, EVENT_STATUSES, type EventOccurrence, type EventPatch, zodErrorKeyMap } from '@tempi/core';
import { Trash2Icon, VideoIcon, XIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useId, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { convertFormTimes, type EventFormOutput, type EventFormValues, eventFormSchema } from '@/lib/event-form-values';
import { useCreateEvent, useUpdateEvent, useUpdateOccurrence } from '../hooks/use-event-mutations';
import { DateTimeField } from './date-time-field';
import { useEventPanel } from './event-panel-provider';
import { RecurrenceFields } from './recurrence-fields';
import { TimeZoneCombobox } from './time-zone-combobox';

const isFormField = (values: EventFormValues, field: string): field is keyof EventFormValues => Object.hasOwn(values, field);

/** Reminder choices in minutes before the start; null is no reminder. */
const REMINDERS = [null, 0, 5, 10, 15, 30, 60, 1440] as const;

type EventFormProps = {
	calendars: readonly Calendar[];
	defaultValues: EventFormValues;
	/** The event or occurrence being edited, or null for a new one. */
	event: EventOccurrence | null;
	/** Unsaved edits to start with (an assistant proposal to review), marked as changed so Save sends them. */
	changes?: Partial<EventFormValues> | undefined;
};

/**
 * The event detail is this form, editable in place: a new event shows Create, an existing one shows Save and
 * Discard once something changed, and Delete. Every rule comes from core's event schema.
 */
export function EventForm({ calendars, changes, defaultValues, event }: EventFormProps) {
	const { t } = useTranslation();
	const id = useId();
	const { chooseScope, close, openEvent, requestDelete } = useEventPanel();
	const createEvent = useCreateEvent();
	const updateEvent = useUpdateEvent();
	const updateOccurrence = useUpdateOccurrence();
	const form = useForm<EventFormValues, unknown, EventFormOutput>({ defaultValues, resolver: zodResolver(eventFormSchema, { error: zodErrorKeyMap }) });
	const { control, formState, getValues, handleSubmit, reset, setError, setValue, watch } = form;
	const allDay = watch('allDay');
	// Applied once after mount: react-hook-form only marks a field dirty through `setValue`, never through defaults.
	const applyChanges = useEffectEvent(() => {
		if (changes === undefined) return;
		for (const [field, value] of Object.entries(changes)) {
			if (isFormField(defaultValues, field)) setValue(field, value, { shouldDirty: true });
		}
	});
	useEffect(() => applyChanges(), []);
	const pending = createEvent.isPending || updateEvent.isPending || updateOccurrence.isPending;

	// Issues the backend ties to a field show under it; the rest go to the error toast (`handlesFieldErrors`).
	const showFieldErrors = (error: { issues: readonly { field?: string; key: string }[] }) => {
		for (const issue of error.issues) {
			if (issue.field !== undefined && isFormField(defaultValues, issue.field)) setError(issue.field, { message: issue.key });
		}
	};

	const submit = handleSubmit(async values => {
		const onSuccess = (saved: Parameters<typeof asOccurrence>[0]) => openEvent(asOccurrence(saved));
		if (event === null) {
			createEvent.mutate(values, { onError: showFieldErrors, onSuccess });
			return;
		}
		const { dirtyFields } = formState;
		const repeatChanged = dirtyFields.repeat === true || dirtyFields.recurrence !== undefined;
		const timesChanged = dirtyFields.allDay || dirtyFields.startAt || dirtyFields.endAt || dirtyFields.timeZone;
		// Only what the user changed, so an occurrence's edit doesn't copy every field onto the rest of its series.
		const patch: EventPatch = {
			...Object.fromEntries(
				(['calendarId', 'description', 'location', 'reminderMinutes', 'status', 'title', 'videoUrl'] as const).filter(key => dirtyFields[key]).map(key => [key, values[key]])
			),
			...(timesChanged && { allDay: values.allDay, endAt: values.endAt, startAt: values.startAt, timeZone: values.timeZone }),
			...(repeatChanged && { rrule: values.rrule }),
		};
		if (event.series === null) {
			updateEvent.mutate({ id: event.id, patch }, { onError: showFieldErrors, onSuccess });
			return;
		}
		// A changed recurrence can't apply to one occurrence alone.
		const scope = await chooseScope({ action: 'edit', allowThis: !repeatChanged, title: event.title });
		if (scope !== null) updateOccurrence.mutate({ occurrence: { ...event, series: event.series }, patch, scope }, { onError: showFieldErrors, onSuccess: openEvent });
	});

	// The hours before switching to all day, restored when switching back.
	const timedTimes = useRef<Pick<EventFormValues, 'endAt' | 'startAt'>>(undefined);
	const toggleAllDay = (checked: boolean) => {
		const values = getValues();
		if (checked) timedTimes.current = { endAt: values.endAt, startAt: values.startAt };
		const times = convertFormTimes(values, checked, timedTimes.current);
		setValue('allDay', checked, { shouldDirty: true });
		setValue('startAt', times.startAt, { shouldDirty: true });
		setValue('endAt', times.endAt, { shouldDirty: true });
	};

	// Events of a read-only calendar (synced, e.g. holidays) show but can't change; none can move into one.
	const readOnly = event !== null && calendars.some(calendar => calendar.id === event.calendarId && calendar.readOnly);
	const calendarItems = calendars
		.filter(calendar => !calendar.readOnly || calendar.id === defaultValues.calendarId)
		.map(calendar => ({ color: calendar.color, label: calendar.name, value: calendar.id }));
	const reminderLabel = (minutes: number | null) => {
		if (minutes === null) return t('events.reminders.none');
		if (minutes === 0) return t('events.reminders.atStart');
		if (minutes === 60) return t('events.reminders.hour');
		if (minutes === 1440) return t('events.reminders.day');
		return t('events.reminders.minutes', { count: minutes });
	};
	const statusItems = EVENT_STATUSES.map(status => ({ label: t(`events.status.${status}`), value: status }));
	const reminderItems = REMINDERS.map(minutes => ({ label: reminderLabel(minutes), value: minutes === null ? 'none' : String(minutes) }));

	return (
		<form className='flex h-full min-h-0 flex-col' noValidate onSubmit={submit}>
			<div className='flex items-center justify-between gap-2 border-b px-3 py-2'>
				<h2 className='truncate font-heading text-sm font-semibold'>{event === null ? t('events.newEvent') : event.title}</h2>
				<Button aria-label={t('actions.close')} onClick={close} size='icon-sm' type='button' variant='ghost'>
					<XIcon />
				</Button>
			</div>
			<fieldset className='contents' disabled={readOnly}>
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
									required
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
					<div className='grid gap-3'>
						{(['startAt', 'endAt'] as const).map(name => (
							<Controller
								control={control}
								key={name}
								name={name}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor={`${id}-${name}`}>{t(name === 'startAt' ? 'events.form.start' : 'events.form.end')}</FieldLabel>
										<DateTimeField
											allDay={allDay}
											dateLabel={t(name === 'startAt' ? 'events.form.startDate' : 'events.form.endDate')}
											id={`${id}-${name}`}
											invalid={fieldState.invalid}
											onBlur={field.onBlur}
											onChange={field.onChange}
											ref={field.ref}
											required
											timeLabel={t(name === 'startAt' ? 'events.form.startTime' : 'events.form.endTime')}
											value={field.value}
										/>
										<FormFieldError error={fieldState.error} />
									</Field>
								)}
							/>
						))}
					</div>
					<RecurrenceFields control={control} id={id} />
					<Controller
						control={control}
						name='timeZone'
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${id}-time-zone`}>{t('events.form.timeZone')}</FieldLabel>
								<TimeZoneCombobox id={`${id}-time-zone`} invalid={fieldState.invalid} onChange={field.onChange} ref={field.ref} required value={field.value} />
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
								<Select items={calendarItems} onValueChange={value => value !== null && field.onChange(value)} required value={field.value}>
									<SelectTrigger aria-invalid={fieldState.invalid || undefined} className='w-full' id={`${id}-calendar`} ref={field.ref}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{calendarItems.map(item => (
											<SelectItem key={item.value} value={item.value}>
												<span aria-hidden className='size-2.5 shrink-0 self-center rounded-full' style={{ backgroundColor: item.color }} />
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
						name='status'
						render={({ field }) => (
							<Field>
								<FieldLabel htmlFor={`${id}-status`}>{t('events.form.status')}</FieldLabel>
								<Select items={statusItems} onValueChange={value => value !== null && field.onChange(value)} value={field.value}>
									<SelectTrigger className='w-full' id={`${id}-status`} ref={field.ref}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{statusItems.map(item => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						)}
					/>
					<Controller
						control={control}
						name='videoUrl'
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${id}-video`}>{t('events.form.videoUrl')}</FieldLabel>
								<div className='flex gap-2'>
									<Input aria-invalid={fieldState.invalid || undefined} id={`${id}-video`} inputMode='url' placeholder='https://' type='url' {...field} />
									{/* The saved link only: core has validated it. The desktop app opens new-window links with shell.openExternal. */}
									{event?.videoUrl && (
										<a className={buttonVariants()} href={event.videoUrl} rel='noreferrer' target='_blank'>
											<VideoIcon data-icon='inline-start' />
											{t('events.join')}
										</a>
									)}
								</div>
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
			</fieldset>
			<div className='flex flex-wrap items-center gap-2 border-t px-3 py-2'>
				{readOnly && <p className='text-xs text-muted-foreground'>{t('events.form.readOnly')}</p>}
				{event !== null && !readOnly && (
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
