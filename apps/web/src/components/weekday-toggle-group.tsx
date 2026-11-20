'use client';

import { ISO_WEEKDAYS, type WeekStart } from '@tempi/core';
import { startOfWeek } from '@usecalendar/core';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// 2024-01-01 was a Monday, so day N of that week has `dayOfWeek` N.
const MONDAY = Temporal.PlainDate.from('2024-01-01');

const weekdayName = (day: number, locale: string, width: 'long' | 'short'): string => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: width }).format(Date.UTC(2024, 0, day));

type WeekdayToggleGroupProps = {
	'aria-label': string;
	invalid?: boolean;
	onChange: (days: number[]) => void;
	ref?: Ref<HTMLDivElement>;
	/** Weekdays numbered like `Temporal.PlainDate#dayOfWeek`: 1 is Monday, 7 is Sunday. */
	value: readonly number[];
	weekStart: WeekStart;
};

/** One toggle per weekday, in the user's week order and language; the value stays sorted Monday first. */
export function WeekdayToggleGroup({ 'aria-label': label, invalid = false, onChange, ref, value, weekStart }: WeekdayToggleGroupProps) {
	const { i18n } = useTranslation();
	const first = startOfWeek(MONDAY, weekStart);
	const ordered = ISO_WEEKDAYS.map(offset => first.add({ days: offset - 1 }).dayOfWeek);

	return (
		<ToggleGroup
			aria-invalid={invalid || undefined}
			aria-label={label}
			className='flex-wrap'
			multiple
			onValueChange={values => onChange(ISO_WEEKDAYS.filter(day => values.includes(String(day))))}
			ref={ref}
			size='sm'
			value={value.map(String)}
			variant='outline'
		>
			{ordered.map(day => (
				<ToggleGroupItem aria-label={weekdayName(day, i18n.language, 'long')} key={day} value={String(day)}>
					{weekdayName(day, i18n.language, 'short')}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
