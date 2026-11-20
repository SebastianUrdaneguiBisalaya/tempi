'use client';

import { useId } from 'react';
import { SettingsReplica, type SettingsTab } from '@/components/settings-replica';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useHydrated } from '@/lib/hydrated';
import type { Locale } from '@/lib/i18n';
import { WORKING_HOURS } from '@/lib/sample-calendar';
import { WeekdayToggles } from './weekday-toggles';

export type WorkingHoursCopy = { label: string; description: string; days: string; start: string; end: string };

const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** Settings › Calendar with the app's `WorkingHoursFields` turned on: Monday to Friday, 09:00 to 18:00. */
export function WorkingHoursReplica({ locale, copy, tabs }: { locale: Locale; copy: WorkingHoursCopy; tabs: Record<SettingsTab, string> }) {
	const id = useId();
	// The weekday names come from `Intl`, which Node and browsers space differently.
	const hydrated = useHydrated();

	return (
		<SettingsReplica tabs={tabs} active='calendar'>
			<FieldSet>
				<Field orientation='horizontal'>
					<FieldContent>
						<FieldLabel htmlFor={`${id}-enabled`}>{copy.label}</FieldLabel>
						<FieldDescription>{copy.description}</FieldDescription>
					</FieldContent>
					<Switch checked id={`${id}-enabled`} />
				</Field>
				<Field>
					<FieldLegend variant='label'>{copy.days}</FieldLegend>
					{hydrated ? <WeekdayToggles locale={locale} /> : <div className='h-6' />}
				</Field>
				<div className='flex flex-wrap gap-4'>
					{(
						[
							['start', WORKING_HOURS.start],
							['end', WORKING_HOURS.end],
						] as const
					).map(([key, hour]) => (
						<Field key={key} className='w-32'>
							<FieldLabel htmlFor={`${id}-${key}`}>{copy[key]}</FieldLabel>
							<Input id={`${id}-${key}`} readOnly type='time' value={pad(hour)} />
						</Field>
					))}
				</div>
			</FieldSet>
		</SettingsReplica>
	);
}
