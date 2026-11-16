'use client';

import { MONTHLY_MODES, monthWeekday, RECURRENCE_ENDS, RECURRENCE_FREQUENCIES, RECURRENCE_PRESETS, type RecurrenceFrequency, resolveLanguage, WEEKDAYS, type Weekday } from '@tempi/core';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatMonthDay, formatWeekday } from '@/lib/date-format';
import type { EventFormOutput, EventFormValues } from '@/lib/event-form-values';
import { toUtcDate } from '@/lib/plain-date';

const UNIT_KEYS = { DAILY: 'day', MONTHLY: 'month', WEEKLY: 'week', YEARLY: 'year' } as const satisfies Record<RecurrenceFrequency, string>;
const NTH_KEYS = { '-1': 'last', '1': 'first', '2': 'second', '3': 'third', '4': 'fourth' } as const;
/**
 * A day that falls on `weekday`, to print its name: 2026-03-02 is a Monday, so offsets 0–6 follow ISO order.
 * Built on call, not at import: the static export prerenders in Node, which has no `Temporal`.
 */
const dayOfWeekday = (weekday: Weekday): Temporal.PlainDate => Temporal.PlainDate.from('2026-03-02').add({ days: WEEKDAYS.indexOf(weekday) });

/** The day the form's start falls on, or today while the start is being typed. */
const startDay = (startAt: string): Temporal.PlainDate => {
	try {
		return Temporal.PlainDate.from(startAt.slice(0, 10));
	} catch {
		return Temporal.Now.plainDateISO();
	}
};

type RecurrenceFieldsProps = {
	control: Control<EventFormValues, unknown, EventFormOutput>;
	id: string;
};

/** The event form's Repeat choice, with the full rule editor under it when Custom is picked. */
export function RecurrenceFields({ control, id }: RecurrenceFieldsProps) {
	const { i18n, t } = useTranslation();
	const language = resolveLanguage([i18n.language]);
	const [repeat, frequency, ends, startAt] = useWatch({ control, name: ['repeat', 'recurrence.frequency', 'recurrence.ends', 'startAt'] });

	const day = startDay(startAt);
	const dayDate = toUtcDate(day);
	const utc = { language, timeZone: 'UTC' };
	const weekdayName = (weekday: Weekday, style: 'long' | 'short') => formatWeekday(toUtcDate(dayOfWeekday(weekday)), utc, style);
	const { nth, weekday } = monthWeekday(day);

	const presetLabels = {
		custom: t('events.repeat.custom'),
		daily: t('events.repeat.daily'),
		monthly: t('events.repeat.monthly', { day: day.day }),
		none: t('events.repeat.none'),
		weekly: t('events.repeat.weekly', { weekday: formatWeekday(dayDate, utc, 'long') }),
		yearly: t('events.repeat.yearly', { date: formatMonthDay(dayDate, utc) }),
	};
	const presetItems = RECURRENCE_PRESETS.map(preset => ({ label: presetLabels[preset], value: preset }));
	const unitItems = RECURRENCE_FREQUENCIES.map(value => ({ label: t(`events.repeat.units.${UNIT_KEYS[value]}`), value }));
	const monthlyItems = MONTHLY_MODES.map(value => ({
		label:
			value === 'dayOfMonth'
				? t('events.repeat.monthlyMode.dayOfMonth', { day: day.day })
				: t('events.repeat.monthlyMode.weekdayOfMonth', { nth: t(`events.repeat.nth.${NTH_KEYS[nth]}`), weekday: weekdayName(weekday, 'long') }),
		value,
	}));
	const endLabels = { count: t('events.repeat.count'), never: t('events.repeat.never'), until: t('events.repeat.until') };

	return (
		<>
			<Controller
				control={control}
				name='repeat'
				render={({ field }) => (
					<Field>
						<FieldLabel htmlFor={`${id}-repeat`}>{t('events.repeat.label')}</FieldLabel>
						<Select items={presetItems} onValueChange={value => value !== null && field.onChange(value)} value={field.value}>
							<SelectTrigger className='w-full' id={`${id}-repeat`} ref={field.ref}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{presetItems.map(item => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			/>
			{repeat === 'custom' && (
				<fieldset className='grid gap-3 rounded-md border p-3'>
					<legend className='sr-only'>{presetLabels.custom}</legend>
					<Controller
						control={control}
						name='recurrence.interval'
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${id}-interval`}>{t('events.repeat.every')}</FieldLabel>
								<div className='flex gap-2'>
									<Input
										aria-invalid={fieldState.invalid || undefined}
										className='w-20'
										id={`${id}-interval`}
										min={1}
										name={field.name}
										onBlur={field.onBlur}
										onChange={event => field.onChange(event.target.valueAsNumber)}
										ref={field.ref}
										type='number'
										value={Number.isNaN(field.value) ? '' : field.value}
									/>
									<Controller
										control={control}
										name='recurrence.frequency'
										render={({ field: unit }) => (
											<Select items={unitItems} onValueChange={value => value !== null && unit.onChange(value)} value={unit.value}>
												<SelectTrigger aria-label={t('events.repeat.every')} className='flex-1' ref={unit.ref}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{unitItems.map(item => (
														<SelectItem key={item.value} value={item.value}>
															{item.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>
								<FormFieldError error={fieldState.error} />
							</Field>
						)}
					/>
					{frequency === 'WEEKLY' && (
						<Controller
							control={control}
							name='recurrence.weekdays'
							render={({ field }) => (
								<Field>
									<FieldLabel id={`${id}-weekdays`}>{t('events.repeat.on')}</FieldLabel>
									<ToggleGroup
										aria-labelledby={`${id}-weekdays`}
										className='flex-wrap'
										multiple
										onValueChange={field.onChange}
										size='sm'
										spacing={1}
										value={field.value}
										variant='outline'
									>
										{WEEKDAYS.map(value => (
											<ToggleGroupItem aria-label={weekdayName(value, 'long')} key={value} value={value}>
												{weekdayName(value, 'short')}
											</ToggleGroupItem>
										))}
									</ToggleGroup>
								</Field>
							)}
						/>
					)}
					{frequency === 'MONTHLY' && (
						<Controller
							control={control}
							name='recurrence.monthlyMode'
							render={({ field }) => (
								<Select items={monthlyItems} onValueChange={value => value !== null && field.onChange(value)} value={field.value}>
									<SelectTrigger aria-label={t('events.repeat.on')} className='w-full' ref={field.ref}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{monthlyItems.map(item => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
					)}
					<Controller
						control={control}
						name='recurrence.ends'
						render={({ field }) => (
							<Field>
								<FieldLabel id={`${id}-ends`}>{t('events.repeat.end')}</FieldLabel>
								<RadioGroup aria-labelledby={`${id}-ends`} className='gap-2' onValueChange={field.onChange} value={field.value}>
									{RECURRENCE_ENDS.map(value => (
										<div className='flex min-h-8 items-center gap-2' key={value}>
											<RadioGroupItem id={`${id}-ends-${value}`} value={value} />
											<FieldLabel className='font-normal' htmlFor={`${id}-ends-${value}`}>
												{endLabels[value]}
											</FieldLabel>
											{value === 'until' && (
												<Controller
													control={control}
													name='recurrence.until'
													render={({ field: until, fieldState }) => (
														<div className='flex-1'>
															<Input aria-invalid={fieldState.invalid || undefined} aria-label={endLabels.until} disabled={ends !== 'until'} type='date' {...until} />
															<FormFieldError error={fieldState.error} />
														</div>
													)}
												/>
											)}
											{value === 'count' && (
												<Controller
													control={control}
													name='recurrence.count'
													render={({ field: count, fieldState }) => (
														<div className='flex flex-1 flex-wrap items-center gap-2'>
															<Input
																aria-invalid={fieldState.invalid || undefined}
																aria-label={`${endLabels.count} (${t('events.repeat.times')})`}
																className='w-20'
																disabled={ends !== 'count'}
																min={1}
																name={count.name}
																onBlur={count.onBlur}
																onChange={event => count.onChange(event.target.valueAsNumber)}
																ref={count.ref}
																type='number'
																value={Number.isNaN(count.value) ? '' : count.value}
															/>
															<span className='text-sm text-muted-foreground'>{t('events.repeat.times')}</span>
															<FormFieldError error={fieldState.error} />
														</div>
													)}
												/>
											)}
										</div>
									))}
								</RadioGroup>
							</Field>
						)}
					/>
				</fieldset>
			)}
		</>
	);
}
