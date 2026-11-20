'use client';

import { ISO_WEEKDAYS, type WeekStart } from '@tempi/core';
import { useId } from 'react';
import { type Control, Controller, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/** The weekday each week start puts first, numbered like `Temporal.PlainDate#dayOfWeek`. */
const FIRST_DAY: Record<WeekStart, number> = { monday: 1, saturday: 6, sunday: 7 };

const orderedWeekdays = (weekStart: WeekStart): number[] => {
	const first = FIRST_DAY[weekStart];
	return ISO_WEEKDAYS.map(offset => ((first + offset - 2) % 7) + 1);
};

// 2024-01-01 was a Monday, so day N of that week has `dayOfWeek` N.
const weekdayName = (day: number, locale: string, width: 'long' | 'short'): string => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: width }).format(Date.UTC(2024, 0, day));

type WorkingHoursFieldsProps<T extends FieldValues> = {
	control: Control<T>;
	/** The form's `workingHours` object field. */
	name: Path<T>;
	weekStart: WeekStart;
};

/** A switch, the working weekdays and one start and end time; days and times stay editable while it is off. */
export function WorkingHoursFields<T extends FieldValues>({ control, name, weekStart }: WorkingHoursFieldsProps<T>) {
	const { i18n, t } = useTranslation();
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
						<ToggleGroup
							aria-label={t('settings.calendar.workingHoursDays')}
							className='flex-wrap'
							multiple
							onValueChange={values => field.onChange(ISO_WEEKDAYS.filter(day => values.includes(String(day))))}
							size='sm'
							value={(field.value as readonly number[]).map(String)}
							variant='outline'
						>
							{orderedWeekdays(weekStart).map(day => (
								<ToggleGroupItem aria-label={weekdayName(day, i18n.language, 'long')} key={day} value={String(day)}>
									{weekdayName(day, i18n.language, 'short')}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
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
