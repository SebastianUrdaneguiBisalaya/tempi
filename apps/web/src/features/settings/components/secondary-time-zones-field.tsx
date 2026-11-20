'use client';

import { MAX_SECONDARY_TIME_ZONES, resolveLanguage } from '@tempi/core';
import { XIcon } from 'lucide-react';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { TimeZoneCombobox } from '@/features/events/components/time-zone-combobox';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { timeZoneLabel } from '@/lib/countries';

type SecondaryTimeZonesFieldProps = {
	id: string;
	invalid: boolean;
	onChange: (zones: string[]) => void;
	ref: Ref<HTMLButtonElement>;
	value: readonly string[];
};

/** The chosen extra zones, each removable, and a picker to add one while there is room. */
export function SecondaryTimeZonesField({ id, invalid, onChange, ref, value }: SecondaryTimeZonesFieldProps) {
	const { i18n, t } = useTranslation();
	const language = resolveLanguage([i18n.language]);
	const timeZone = useTimeZone();

	return (
		<div className='flex flex-col gap-2'>
			{value.length > 0 && (
				<ul className='flex flex-col gap-1'>
					{value.map(zone => {
						const label = timeZoneLabel(zone, language);
						return (
							<li className='flex items-center justify-between gap-2 rounded-md border px-3 py-1.5' key={zone}>
								<span className='truncate text-sm'>{label}</span>
								<Button
									aria-label={t('settings.calendar.secondaryTimeZonesRemove', { zone: label })}
									onClick={() => onChange(value.filter(item => item !== zone))}
									size='icon-sm'
									title={t('settings.calendar.secondaryTimeZonesRemove', { zone: label })}
									type='button'
									variant='ghost'
								>
									<XIcon aria-hidden='true' />
								</Button>
							</li>
						);
					})}
				</ul>
			)}
			{value.length < MAX_SECONDARY_TIME_ZONES && (
				<div className='w-full sm:w-72'>
					<TimeZoneCombobox
						// The calendar's own zone already has its column.
						exclude={[timeZone, ...value]}
						id={id}
						invalid={invalid}
						onChange={zone => onChange([...value, zone])}
						placeholder={t('settings.calendar.secondaryTimeZonesAdd')}
						ref={ref}
						value={null}
					/>
				</div>
			)}
		</div>
	);
}
