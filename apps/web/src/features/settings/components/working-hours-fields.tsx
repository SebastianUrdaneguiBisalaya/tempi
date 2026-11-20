'use client';

import type { WeekStart } from '@tempi/core';
import { useId } from 'react';
import { type Control, Controller, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { WeekdayToggleGroup } from '@/components/weekday-toggle-group';

type WorkingHoursFieldsProps<T extends FieldValues> = {
	control: Control<T>;
	/** The form's `workingHours` object field. */
	name: Path<T>;
	weekStart: WeekStart;
};

/** A switch, the working weekdays and one start and end time; days and times stay editable while it is off. */
export function WorkingHoursFields<T extends FieldValues>({ control, name, weekStart }: WorkingHoursFieldsProps<T>) {
	const { t } = useTranslation();
	const id = useId();
	// `Path<T>` can't be narrowed to the nested keys of a generic form, so the sub-paths are built and asserted once here.
	const path = (key: 'days' | 'enabled' | 'end' | 'start') => `${name}.${key}` as Path<T>;

	return (
		<FieldSet>
			<Controller
				control={control}
				name={path('enabled')}
				render={({ field }) => (
					<Field orientation='horizontal'>
						<FieldContent>
							<FieldLabel htmlFor={`${id}-enabled`}>{t('settings.calendar.workingHours')}</FieldLabel>
							<FieldDescription>{t('settings.calendar.workingHoursDescription')}</FieldDescription>
						</FieldContent>
						<Switch checked={field.value} id={`${id}-enabled`} onCheckedChange={checked => field.onChange(checked)} ref={field.ref} />
					</Field>
				)}
			/>
			<Controller
				control={control}
				name={path('days')}
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid || undefined}>
						<FieldLegend variant='label'>{t('settings.calendar.workingHoursDays')}</FieldLegend>
						<WeekdayToggleGroup aria-label={t('settings.calendar.workingHoursDays')} invalid={fieldState.invalid} onChange={field.onChange} value={field.value} weekStart={weekStart} />
						<FormFieldError error={fieldState.error} />
					</Field>
				)}
			/>
			<div className='flex flex-wrap gap-4'>
				{(['start', 'end'] as const).map(key => (
					<Controller
						control={control}
						key={key}
						name={path(key)}
						render={({ field, fieldState }) => (
							<Field className='w-32' data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${id}-${key}`}>{t(`settings.calendar.workingHours${key === 'start' ? 'Start' : 'End'}`)}</FieldLabel>
								<Input
									aria-invalid={fieldState.invalid || undefined}
									id={`${id}-${key}`}
									onBlur={field.onBlur}
									onChange={event => field.onChange(event.target.value)}
									ref={field.ref}
									required
									type='time'
									value={field.value}
								/>
								<FormFieldError error={fieldState.error} />
							</Field>
						)}
					/>
				))}
			</div>
		</FieldSet>
	);
}
