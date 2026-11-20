'use client';

import { BellIcon } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { gsap, useMotion } from '@/lib/gsap';
import { useHydrated } from '@/lib/hydrated';
import type { Locale } from '@/lib/i18n';

export type RecurrenceCopy = {
	repeat: string;
	custom: string;
	every: string;
	unit: string;
	on: string;
	/** The app name the system notification shows; its title is the event's and its body the times, as the desktop app writes them. */
	notificationApp: string;
};

// `Date.getDay()`: Monday, Wednesday and Friday.
const FINAL_DAYS = ['1', '3', '5'];

// A known Sunday, to name each weekday with `Intl`.
const weekdayName = (locale: Locale, day: number) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 10, 15 + day));

// Like apps/desktop `reminderContent`: the event's times, for a standup today at 9:00.
const reminderTimes = (locale: Locale) => {
	const now = new Date();
	const at = (minutes: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, minutes);
	return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).formatRange(at(0), at(30));
};

type RecurrenceReplicaProps = {
	locale: Locale;
	copy: RecurrenceCopy;
	/** The repeating event's title. */
	title: string;
};

/** Replica of the event form's custom repeat fields (apps/web `recurrence-fields.tsx`) and the reminder it sends. */
export function RecurrenceReplica({ locale, copy, title }: RecurrenceReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const hydrated = useHydrated();
	const [days, setDays] = useState(FINAL_DAYS);
	const weekStart = locale === 'es' ? 1 : 0;
	const order = Array.from({ length: 7 }, (_, index) => (weekStart + index) % 7);

	useMotion(ref, () => {
		setDays(['1']);
		const demo = gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 });
		demo.call(() => setDays(['1', '3']))
			.call(() => setDays(FINAL_DAYS), [], '+=0.5')
			.from('[data-reminder]', { autoAlpha: 0, x: 24, duration: 0.5, ease: 'power3.out' }, '+=0.6');
		return () => setDays(FINAL_DAYS);
	});

	return (
		<div ref={ref} className='relative w-full max-w-sm pb-10'>
			<div className='flex flex-col gap-3 rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
				<Field>
					<FieldLabel>{copy.repeat}</FieldLabel>
					<Select items={[{ label: copy.custom, value: 'custom' }]} value='custom'>
						<SelectTrigger className='w-full' tabIndex={-1}>
							<SelectValue />
						</SelectTrigger>
					</Select>
				</Field>
				<div className='grid gap-3 rounded-md border p-3'>
					<Field>
						<FieldLabel>{copy.every}</FieldLabel>
						<div className='flex gap-2'>
							<Input className='w-20' readOnly tabIndex={-1} type='number' value={1} />
							<Select items={[{ label: copy.unit, value: 'WEEKLY' }]} value='WEEKLY'>
								<SelectTrigger className='flex-1' tabIndex={-1}>
									<SelectValue />
								</SelectTrigger>
							</Select>
						</div>
					</Field>
					<Field>
						<FieldLabel>{copy.on}</FieldLabel>
						<ToggleGroup className='flex-wrap' multiple size='sm' spacing={1} value={days} variant='outline'>
							{order.map(day => (
								<ToggleGroupItem key={day} value={String(day)} tabIndex={-1} className='min-w-9'>
									{hydrated ? weekdayName(locale, day) : ''}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</Field>
				</div>
			</div>
			{/* The reminder, as the system shows it. */}
			<div
				data-reminder
				className='absolute right-0 bottom-0 flex w-64 items-start gap-2.5 rounded-xl bg-popover/95 p-3 text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/60 ring-1 ring-foreground/15 backdrop-blur sm:-right-6'
			>
				<span className='flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground'>
					{/* Same tile as the hero's assistant entry: the padded icon drawn larger than it. */}
					<Image src='/tempi-icon.png' alt='' width={48} height={48} className='size-12 max-w-none invert' />
				</span>
				<div className='flex min-w-0 flex-col'>
					<span className='flex items-center gap-1 text-[0.65rem] text-muted-foreground'>
						<BellIcon className='size-3' />
						{copy.notificationApp}
					</span>
					<span className='truncate font-medium'>{title}</span>
					<span className='h-4 text-muted-foreground'>{hydrated && reminderTimes(locale)}</span>
				</div>
			</div>
		</div>
	);
}
