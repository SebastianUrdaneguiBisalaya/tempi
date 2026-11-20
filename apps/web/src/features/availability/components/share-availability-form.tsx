'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { DEFAULT_FREE_SLOT_MINUTES, DEFAULT_FREE_SLOT_WINDOW, DEFAULT_SETTINGS, freeSlotsQuerySchema, resolveLanguage, type WeekStart, zodErrorKeyMap } from '@tempi/core';
import { startOfWeek } from '@usecalendar/core';
import { CopyIcon } from 'lucide-react';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { FormFieldError } from '@/components/form-field-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WeekdayToggleGroup } from '@/components/weekday-toggle-group';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { availabilityText } from '../availability-text';
import { useCopyText, useFreeSlots } from '../hooks/use-free-slots';

const RANGES = ['thisWeek', 'nextWeek', 'custom'] as const;
type RangeChoice = (typeof RANGES)[number];

// `range` only picks the dates; the search itself is the core query.
const formSchema = freeSlotsQuerySchema.safeExtend({ range: z.enum(RANGES) });
type FormInput = z.input<typeof formSchema>;

/** The days a preset covers: the rest of this week from today, or the whole next week. */
const presetDates = (range: Exclude<RangeChoice, 'custom'>, today: Temporal.PlainDate, weekStart: WeekStart) => {
	const start = startOfWeek(today, weekStart);
	return range === 'thisWeek' ? { from: today.toString(), to: start.add({ days: 6 }).toString() } : { from: start.add({ days: 7 }).toString(), to: start.add({ days: 13 }).toString() };
};

/** The search's fields with a live preview of the text, and a button that copies it. */
export function ShareAvailabilityForm() {
	const { i18n, t } = useTranslation();
	const id = useId();
	const timeZone = useTimeZone();
	const { today } = useCalendarNavigation();
	const { data: settings } = useSettings();
	const { data: calendars } = useCalendars();
	const { timeFormat, weekStart, workingHours } = settings ?? DEFAULT_SETTINGS;
	const hours = workingHours.enabled ? workingHours : DEFAULT_FREE_SLOT_WINDOW;
	const day = today ?? Temporal.Now.plainDateISO(timeZone);

	const form = useForm<FormInput>({
		defaultValues: {
			...presetDates('thisWeek', day, weekStart),
			days: [...hours.days],
			minMinutes: DEFAULT_FREE_SLOT_MINUTES,
			range: 'thisWeek',
			windowEnd: hours.end,
			windowStart: hours.start,
		},
		mode: 'onChange',
		resolver: zodResolver(formSchema, { error: zodErrorKeyMap }),
	});
	const values = useWatch({ control: form.control });
	// Left out until the user picks, so calendars that load after the form opens still count.
	const visibleIds = (calendars ?? []).filter(calendar => calendar.isVisible).map(calendar => calendar.id);
	const chosenIds = values.calendarIds ?? visibleIds;
	// The core schema strips the form-only `range`.
	const parsed = freeSlotsQuerySchema.safeParse({ ...values, calendarIds: values.calendarIds ?? (visibleIds.length > 0 ? visibleIds : undefined) });
	const freeSlots = useFreeSlots(parsed.success ? parsed.data : null);
	const copy = useCopyText();

	const language = resolveLanguage([i18n.language]);
	const text =
		parsed.success && freeSlots.data !== undefined
			? availabilityText(freeSlots.data, { labels: { empty: t('availability.empty'), timesIn: zone => t('availability.timesIn', { zone }) }, language, timeFormat })
			: null;

	const chooseRange = (range: RangeChoice) => {
		form.setValue('range', range);
		if (range === 'custom') return;
		const dates = presetDates(range, day, weekStart);
		form.setValue('from', dates.from, { shouldValidate: true });
		form.setValue('to', dates.to, { shouldValidate: true });
	};

	return (
		<form
			className='flex flex-col gap-5'
			noValidate
			onSubmit={event => {
				event.preventDefault();
				if (text !== null) copy.mutate(text);
			}}
		>
			<FieldGroup className='gap-4'>
				<FieldSet>
					<FieldLegend variant='label'>{t('availability.range')}</FieldLegend>
					<ToggleGroup
						aria-label={t('availability.range')}
						className='flex-wrap'
						onValueChange={([selected]) => {
							const range = RANGES.find(option => option === selected);
							if (range !== undefined) chooseRange(range);
						}}
						size='sm'
						value={[values.range ?? 'thisWeek']}
						variant='outline'
					>
						{RANGES.map(range => (
							<ToggleGroupItem key={range} value={range}>
								{t(`availability.ranges.${range}`)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
					{values.range === 'custom' && (
						<div className='flex flex-wrap gap-4'>
							{(['from', 'to'] as const).map(name => (
								<Controller
									control={form.control}
									key={name}
									name={name}
									render={({ field, fieldState }) => (
										<Field className='w-40' data-invalid={fieldState.invalid || undefined}>
											<FieldLabel htmlFor={`${id}-${name}`}>{t(`availability.${name}`)}</FieldLabel>
											<Input
												aria-invalid={fieldState.invalid || undefined}
												id={`${id}-${name}`}
												onBlur={field.onBlur}
												onChange={event => field.onChange(event.target.value)}
												ref={field.ref}
												required
												type='date'
												value={field.value}
											/>
											<FormFieldError error={fieldState.error} />
										</Field>
									)}
								/>
							))}
						</div>
					)}
				</FieldSet>
				<FieldSet>
					<FieldLegend variant='label'>{t('availability.window')}</FieldLegend>
					<div className='flex flex-wrap gap-4'>
						{(['windowStart', 'windowEnd'] as const).map(name => (
							<Controller
								control={form.control}
								key={name}
								name={name}
								render={({ field, fieldState }) => (
									<Field className='w-32' data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor={`${id}-${name}`}>{t(`availability.${name}`)}</FieldLabel>
										<Input
											aria-invalid={fieldState.invalid || undefined}
											id={`${id}-${name}`}
											onBlur={field.onBlur}
											onChange={event => field.onChange(event.target.value)}
											ref={field.ref}
											required
											type='time'
											value={field.value ?? ''}
										/>
										<FormFieldError error={fieldState.error} />
									</Field>
								)}
							/>
						))}
					</div>
				</FieldSet>
				<Controller
					control={form.control}
					name='days'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLegend variant='label'>{t('availability.days')}</FieldLegend>
							<WeekdayToggleGroup aria-label={t('availability.days')} invalid={fieldState.invalid} onChange={field.onChange} value={field.value ?? []} weekStart={weekStart} />
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				<Controller
					control={form.control}
					name='minMinutes'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel>{t('availability.minMinutes')}</FieldLabel>
							<div className='flex items-center gap-2'>
								<Input
									aria-describedby={`${id}-min-unit`}
									aria-invalid={fieldState.invalid || undefined}
									className='w-24'
									id={`${id}-min`}
									inputMode='numeric'
									max={480}
									min={15}
									onBlur={field.onBlur}
									// An empty field is NaN, which the schema reports as invalid.
									onChange={event => field.onChange(event.target.valueAsNumber)}
									ref={field.ref}
									required
									step={15}
									type='number'
									value={field.value === undefined || Number.isNaN(field.value) ? '' : field.value}
								/>
								<span className='text-muted-foreground' id={`${id}-min-unit`}>
									{t('availability.minutes')}
								</span>
							</div>
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				{(calendars ?? []).length > 1 && (
					<Controller
						control={form.control}
						name='calendarIds'
						render={({ fieldState }) => (
							<FieldSet data-invalid={fieldState.invalid || undefined}>
								<FieldLegend variant='label'>{t('availability.calendars')}</FieldLegend>
								<div className='flex flex-col gap-2'>
									{(calendars ?? []).map(calendar => (
										<Field key={calendar.id} orientation='horizontal'>
											<Checkbox
												checked={chosenIds.includes(calendar.id)}
												id={`${id}-calendar-${calendar.id}`}
												onCheckedChange={checked =>
													form.setValue('calendarIds', checked ? [...chosenIds, calendar.id] : chosenIds.filter(item => item !== calendar.id), {
														shouldDirty: true,
														shouldValidate: true,
													})
												}
											/>
											<FieldLabel className='font-normal' htmlFor={`${id}-calendar-${calendar.id}`}>
												<span aria-hidden='true' className='size-2.5 shrink-0 rounded-full' style={{ backgroundColor: calendar.color }} />
												{calendar.name}
											</FieldLabel>
										</Field>
									))}
								</div>
								<FormFieldError error={fieldState.error} />
							</FieldSet>
						)}
					/>
				)}
			</FieldGroup>
			<section aria-busy={freeSlots.isFetching || undefined} aria-labelledby={`${id}-preview`} className='flex flex-col gap-2'>
				<h3 className='font-medium text-sm' id={`${id}-preview`}>
					{t('availability.preview')}
				</h3>
				<output className='block min-h-24 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm'>
					{text ?? (freeSlots.isFetching ? <Spinner aria-label={t('availability.loading')} /> : null)}
				</output>
			</section>
			<DialogFooter>
				<Button disabled={text === null || copy.isPending} type='submit'>
					<CopyIcon aria-hidden='true' />
					{t('availability.copy')}
				</Button>
			</DialogFooter>
		</form>
	);
}
