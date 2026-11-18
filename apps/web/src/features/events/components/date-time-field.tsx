'use client';

import { resolveLanguage } from '@tempi/core';
import { ChevronDownIcon } from 'lucide-react';
import { type Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDayPickerOptions } from '@/features/calendar/hooks/use-day-picker-options';
import { formatDate } from '@/lib/date-format';
import { fromLocalDate, toLocalDate, toUtcDate } from '@/lib/plain-date';
import { cn } from '@/lib/utils';

// A new start or end that only had a day gets this time when it gains one.
const DEFAULT_TIME = '09:00';

const plainDate = (value: string): Temporal.PlainDate | null => {
	try {
		return Temporal.PlainDate.from(value.slice(0, 10));
	} catch {
		return null;
	}
};

type DateTimeFieldProps = {
	allDay: boolean;
	dateLabel: string;
	disabled?: boolean;
	id: string;
	invalid: boolean;
	onBlur: () => void;
	/** `YYYY-MM-DD` when all day, `YYYY-MM-DDTHH:mm` otherwise: the form's wall-clock value, unchanged. */
	onChange: (value: string) => void;
	ref: Ref<HTMLButtonElement>;
	/** Marks the field as required; the button gets `data-required` since its role can't carry `aria-required`. */
	required?: boolean;
	timeLabel: string;
	value: string;
};

/** A day from a calendar popover and, unless all day, a time beside it; together they make the form's value. */
export function DateTimeField({ allDay, dateLabel, disabled = false, id, invalid, onBlur, onChange, ref, required = false, timeLabel, value }: DateTimeFieldProps) {
	const { i18n } = useTranslation();
	const dayPickerOptions = useDayPickerOptions();
	const [open, setOpen] = useState(false);
	const day = plainDate(value);
	const time = value.slice(11, 16) || DEFAULT_TIME;

	return (
		<div className='flex gap-2'>
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger
					render={
						<Button
							aria-invalid={invalid || undefined}
							aria-label={dateLabel}
							className='min-w-0 flex-1 justify-between font-normal'
							data-required={required || undefined}
							disabled={disabled}
							id={id}
							onBlur={onBlur}
							ref={ref}
							type='button'
							variant='outline'
						/>
					}
				>
					<span className='truncate'>{day === null ? dateLabel : formatDate(toUtcDate(day), { language: resolveLanguage([i18n.language]), timeZone: 'UTC' }, 'medium')}</span>
					<ChevronDownIcon data-icon='inline-end' />
				</PopoverTrigger>
				{/* As wide as the whole row: the date button, plus the time input and the gap when shown (`w-24`, `gap-2`).
				    The generated popover can't anchor to the row, and the generated calendar root is `w-fit`. */}
				<PopoverContent align='start' className={cn('min-w-fit overflow-hidden p-0', allDay ? 'w-(--anchor-width)' : 'w-[calc(var(--anchor-width)+6.5rem)]')}>
					<Calendar
						className='w-full!'
						{...dayPickerOptions}
						defaultMonth={day === null ? undefined : toLocalDate(day)}
						mode='single'
						onSelect={picked => {
							if (picked === undefined) return;
							const date = fromLocalDate(picked).toString();
							onChange(allDay ? date : `${date}T${time}`);
							setOpen(false);
						}}
						selected={day === null ? undefined : toLocalDate(day)}
					/>
				</PopoverContent>
			</Popover>
			{!allDay && (
				<Input
					aria-invalid={invalid || undefined}
					aria-label={timeLabel}
					// The day comes from the button; only the native time entry is kept, without its own picker icon.
					className='w-24 shrink-0 appearance-none [&::-webkit-calendar-picker-indicator]:hidden'
					disabled={disabled}
					onBlur={onBlur}
					onChange={event => {
						if (day !== null && event.target.value !== '') onChange(`${day.toString()}T${event.target.value}`);
					}}
					required={required}
					type='time'
					value={time}
				/>
			)}
		</div>
	);
}
