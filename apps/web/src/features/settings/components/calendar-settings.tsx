'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Settings, settingsValuesSchema, TIME_FORMATS, WEEK_STARTS, zodErrorKeyMap } from '@tempi/core';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormFieldError } from '@/components/form-field-error';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSaveSettings } from '@/features/settings/hooks/use-settings';
import { showFieldErrors } from './field-errors';
import { SecondaryTimeZonesField } from './secondary-time-zones-field';
import { SettingsFooter } from './settings-footer';

const calendarSchema = settingsValuesSchema.pick({
	defaultEventDuration: true,
	iconBadgeEnabled: true,
	menuBarEnabled: true,
	openAtLoginEnabled: true,
	secondaryTimeZones: true,
	showWeekends: true,
	showWeekNumbers: true,
	timeFormat: true,
	weekStart: true,
});
type CalendarValues = z.input<typeof calendarSchema>;

const FIELDS = [
	'defaultEventDuration',
	'iconBadgeEnabled',
	'menuBarEnabled',
	'openAtLoginEnabled',
	'secondaryTimeZones',
	'showWeekends',
	'showWeekNumbers',
	'timeFormat',
	'weekStart',
] as const satisfies readonly (keyof CalendarValues)[];
const isField = (field: string): field is (typeof FIELDS)[number] => FIELDS.some(name => name === field);

const valuesOf = (settings: Settings): CalendarValues => ({
	defaultEventDuration: settings.defaultEventDuration,
	iconBadgeEnabled: settings.iconBadgeEnabled,
	menuBarEnabled: settings.menuBarEnabled,
	openAtLoginEnabled: settings.openAtLoginEnabled,
	secondaryTimeZones: settings.secondaryTimeZones,
	showWeekends: settings.showWeekends,
	showWeekNumbers: settings.showWeekNumbers,
	timeFormat: settings.timeFormat,
	weekStart: settings.weekStart,
});

const SWITCHES = [
	{ name: 'showWeekNumbers', withDescription: false },
	{ name: 'showWeekends', withDescription: false },
	{ name: 'menuBarEnabled', withDescription: true },
	{ name: 'openAtLoginEnabled', withDescription: true },
	{ name: 'iconBadgeEnabled', withDescription: true },
] as const;

/** How the calendar shows weeks, times and extra time zones, the default event length, the menu bar calendar, opening at login and the icon badge. */
export function CalendarSettings({ settings }: { settings: Settings }) {
	const { t } = useTranslation();
	const id = useId();
	const saveSettings = useSaveSettings();
	const form = useForm<CalendarValues>({ defaultValues: valuesOf(settings), resolver: zodResolver(calendarSchema, { error: zodErrorKeyMap }) });
	const weekStartItems = WEEK_STARTS.map(weekStart => ({ label: t(`settings.calendar.weekStarts.${weekStart}`), value: weekStart }));

	const submit = form.handleSubmit(values =>
		saveSettings.mutate(values, {
			onError: error => showFieldErrors(error, form.setError, isField),
			onSuccess: saved => form.reset(valuesOf(saved)),
		})
	);

	return (
		<form className='flex flex-col gap-6' noValidate onSubmit={submit}>
			<FieldGroup className='gap-5'>
				<Controller
					control={form.control}
					name='weekStart'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-week-start`}>{t('settings.calendar.weekStart')}</FieldLabel>
							<Select items={weekStartItems} onValueChange={value => value !== null && field.onChange(value)} required value={field.value}>
								<SelectTrigger className='w-full sm:w-56' id={`${id}-week-start`} ref={field.ref}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{weekStartItems.map(item => (
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
					control={form.control}
					name='timeFormat'
					render={({ field, fieldState }) => (
						<FieldSet>
							<FieldLegend variant='label'>{t('settings.calendar.timeFormat')}</FieldLegend>
							<RadioGroup
								className='flex gap-4'
								onValueChange={value => {
									const format = TIME_FORMATS.find(option => option === value);
									if (format !== undefined) field.onChange(format);
								}}
								required
								value={field.value}
							>
								{TIME_FORMATS.map(format => (
									<div className='flex items-center gap-2' key={format}>
										<RadioGroupItem id={`${id}-time-${format}`} value={format} />
										<FieldLabel className='font-normal' htmlFor={`${id}-time-${format}`}>
											{t(`settings.calendar.timeFormats.${format}`)}
										</FieldLabel>
									</div>
								))}
							</RadioGroup>
							<FormFieldError error={fieldState.error} />
						</FieldSet>
					)}
				/>
				<Controller
					control={form.control}
					name='secondaryTimeZones'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldContent>
								<FieldLabel htmlFor={`${id}-secondary-time-zones`}>{t('settings.calendar.secondaryTimeZones')}</FieldLabel>
								<FieldDescription>{t('settings.calendar.secondaryTimeZonesDescription')}</FieldDescription>
							</FieldContent>
							<SecondaryTimeZonesField id={`${id}-secondary-time-zones`} invalid={fieldState.invalid} onChange={field.onChange} ref={field.ref} value={field.value} />
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				<Controller
					control={form.control}
					name='defaultEventDuration'
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-duration`}>{t('settings.calendar.defaultEventDuration')}</FieldLabel>
							<div className='flex items-center gap-2'>
								<Input
									aria-describedby={`${id}-duration-unit`}
									aria-invalid={fieldState.invalid || undefined}
									className='w-24'
									id={`${id}-duration`}
									inputMode='numeric'
									max={1440}
									min={1}
									onBlur={field.onBlur}
									// An empty field is NaN, which the schema reports as invalid.
									onChange={event => field.onChange(event.target.valueAsNumber)}
									ref={field.ref}
									required
									step={5}
									type='number'
									value={Number.isNaN(field.value) ? '' : field.value}
								/>
								<span className='text-muted-foreground' id={`${id}-duration-unit`}>
									{t('settings.calendar.minutes')}
								</span>
							</div>
							<FormFieldError error={fieldState.error} />
						</Field>
					)}
				/>
				{SWITCHES.map(({ name, withDescription }) => (
					<Controller
						control={form.control}
						key={name}
						name={name}
						render={({ field }) => (
							<Field orientation='horizontal'>
								<FieldContent>
									<FieldLabel htmlFor={`${id}-${name}`}>{t(`settings.calendar.${name}`)}</FieldLabel>
									{withDescription && <FieldDescription>{t(`settings.calendar.${name}Description`)}</FieldDescription>}
								</FieldContent>
								<Switch checked={field.value} id={`${id}-${name}`} onCheckedChange={checked => field.onChange(checked)} ref={field.ref} />
							</Field>
						)}
					/>
				))}
			</FieldGroup>
			<SettingsFooter dirty={form.formState.isDirty} saving={saveSettings.isPending} />
		</form>
	);
}
