'use client';

import { ChevronsUpDownIcon, XIcon } from 'lucide-react';
import { SettingsReplica, type SettingsTab } from '@/components/settings-replica';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import type { Locale } from '@/lib/i18n';
import { secondaryZone } from '@/lib/sample-calendar';
import { useToday } from '@/lib/use-today';

export type SecondaryZonesCopy = { label: string; description: string; add: string };

const namePart = (zone: string, locale: Locale, style: Intl.DateTimeFormatOptions['timeZoneName']) =>
	new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value ?? '';

/** The app's `timeZoneLabel`, e.g. "Eastern Time · New York (GMT-5)". */
const zoneLabel = (zone: string, locale: Locale) => `${namePart(zone, locale, 'longGeneric')} · ${(zone.split('/').pop() ?? zone).replaceAll('_', ' ')} (${namePart(zone, locale, 'shortOffset')})`;

/**
 * Settings › Calendar with the app's `SecondaryTimeZonesField`: the zone the hero's week view shows as an extra hour
 * column, and the picker to add a second one.
 */
export function SecondaryZonesReplica({ locale, copy, tabs }: { locale: Locale; copy: SecondaryZonesCopy; tabs: Record<SettingsTab, string> }) {
	const today = useToday();
	const zone = today === null ? undefined : secondaryZone(today, locale);

	return (
		<SettingsReplica tabs={tabs} active='calendar'>
			<Field>
				<FieldContent>
					<FieldLabel>{copy.label}</FieldLabel>
					<FieldDescription>{copy.description}</FieldDescription>
				</FieldContent>
				<div className='flex flex-col gap-2'>
					<ul className='flex flex-col gap-1'>
						<li className='flex h-9 items-center justify-between gap-2 rounded-md border px-3 py-1.5'>
							<span className='truncate text-sm'>{zone && zoneLabel(zone, locale)}</span>
							<Button size='icon-sm' variant='ghost'>
								<XIcon aria-hidden='true' />
							</Button>
						</li>
					</ul>
					<Button className='w-full justify-between font-normal' variant='outline'>
						<span className='truncate text-muted-foreground'>{copy.add}</span>
						<ChevronsUpDownIcon aria-hidden='true' className='text-muted-foreground' />
					</Button>
				</div>
			</Field>
		</SettingsReplica>
	);
}
