'use client';

import { cn } from 'cn';
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { gsap, useMotion } from '@/lib/gsap';
import { useHydrated } from '@/lib/hydrated';
import type { Locale } from '@/lib/i18n';

export type TimeZonesCopy = {
	allDay: string;
	timeZone: string;
	search: string;
	/** What the demo types into the search; it should match one of `ZONES`. */
	query: string;
};

const ZONES = ['America/Lima', 'America/New_York', 'Europe/Madrid', 'Asia/Tokyo', 'Australia/Sydney'] as const;

type Zone = (typeof ZONES)[number];

const FROM: Zone = 'America/Lima';
const TO: Zone = 'Asia/Tokyo';

const namePart = (zone: string, locale: Locale, style: Intl.DateTimeFormatOptions['timeZoneName']) =>
	new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value ?? '';

/** Same label as the app's picker (apps/web `timeZoneLabel`): "Japan Time · Tokyo (GMT+9)". */
const zoneLabel = (zone: string, locale: Locale) => `${namePart(zone, locale, 'longGeneric')} · ${(zone.split('/').pop() ?? zone).replaceAll('_', ' ')} (${namePart(zone, locale, 'shortOffset')})`;

const TYPE_DELAY = 0.1;

/** The event form's all-day switch and time zone picker (apps/web `event-form.tsx`, `time-zone-combobox.tsx`); on enter a zone is searched and picked. */
export function TimeZonesReplica({ locale, copy }: { locale: Locale; copy: TimeZonesCopy }) {
	const ref = useRef<HTMLDivElement>(null);
	const hydrated = useHydrated();
	const [typed, setTyped] = useState(copy.query);
	const [zone, setZone] = useState<Zone>(TO);

	useMotion(ref, () => {
		setTyped('');
		setZone(FROM);
		const demo = gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 });
		for (let index = 1; index <= copy.query.length; index++) {
			demo.call(() => setTyped(copy.query.slice(0, index)), [], `+=${TYPE_DELAY}`);
		}
		demo.call(() => setZone(TO), [], '+=0.6');
		return () => {
			setTyped(copy.query);
			setZone(TO);
		};
	});

	const query = typed.trim().toLocaleLowerCase(locale);
	const shown = hydrated ? ZONES.filter(option => `${zoneLabel(option, locale)} ${option}`.toLocaleLowerCase(locale).includes(query)) : [];

	return (
		<div ref={ref} className='flex w-full max-w-sm flex-col gap-3 rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<Field orientation='horizontal'>
				<Switch checked={false} tabIndex={-1} />
				<FieldLabel>{copy.allDay}</FieldLabel>
			</Field>
			<Field>
				<FieldLabel>{copy.timeZone}</FieldLabel>
				<Button className='w-full justify-between font-normal' variant='outline'>
					<span className='truncate'>{hydrated && zoneLabel(zone, locale)}</span>
					<ChevronsUpDownIcon className='text-muted-foreground' />
				</Button>
			</Field>
			{/* The picker's popover, open under the field. */}
			<div className='overflow-hidden rounded-lg ring-1 ring-foreground/10'>
				<div className='flex h-9 items-center gap-2 border-b px-3'>
					<SearchIcon className='size-3.5 shrink-0 opacity-50' />
					{typed === '' ? <span className='text-muted-foreground'>{copy.search}</span> : <span className='truncate'>{typed}</span>}
				</div>
				<ul className='h-36 overflow-hidden p-1'>
					{shown.map(option => (
						<li key={option} className={cn('flex items-center gap-2 rounded-md px-2.5 py-1.5', option === zone && query !== '' && 'bg-muted')}>
							<span className='truncate'>{zoneLabel(option, locale)}</span>
							{option === zone && <CheckIcon className='ml-auto size-3.5 shrink-0' />}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
