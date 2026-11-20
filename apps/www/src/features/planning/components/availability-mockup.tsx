'use client';

import { CopyIcon, XIcon } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatShortDate, formatTimeRange, formatTimeZoneOffset } from '@/lib/date-format';
import type { Locale } from '@/lib/i18n';
import { addDays, at, CALENDARS, type CalendarKey, type FreeDay, freeSlots, presetRange, WORKING_HOURS, weekStartFor } from '@/lib/sample-calendar';
import { useToday } from '@/lib/use-today';

const RANGES = ['thisWeek', 'nextWeek', 'custom'] as const;

export type AvailabilityCopy = {
	/** Describes the replica for assistive tech, which skips the replica itself. */
	label: string;
	title: string;
	description: string;
	range: string;
	ranges: Record<(typeof RANGES)[number], string>;
	window: string;
	windowStart: string;
	windowEnd: string;
	days: string;
	minMinutes: string;
	minutes: string;
	calendars: string;
	preview: string;
	empty: string;
	/** With a `{zone}` placeholder. */
	timesIn: string;
	copy: string;
};

const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

// 2024-01-01 was a Monday, so day N of that week has ISO weekday N.
const weekdayName = (day: number, locale: Locale, width: 'long' | 'short') => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: width }).format(Date.UTC(2024, 0, day));

/** The free time as the app's `availabilityText` writes it: one line per day with free slots, then the zone. */
const availabilityText = (days: readonly FreeDay[], today: Date, locale: Locale, copy: AvailabilityCopy) => {
	const withSlots = days.filter(day => day.slots.length > 0);
	const first = withSlots[0];
	const firstSlot = first?.slots[0];
	if (first === undefined || firstSlot === undefined) return copy.empty;
	const lines = withSlots.map(({ day, slots }) => {
		const date = addDays(today, day);
		return `${formatShortDate(date, locale)}: ${slots.map(slot => formatTimeRange(at(date, slot.start), at(date, slot.end), locale)).join(', ')}`;
	});
	return [...lines, '', copy.timesIn.replace('{zone}', formatTimeZoneOffset(at(addDays(today, first.day), firstSlot.start), locale))].join('\n');
};

/**
 * Static replica of the app's Share availability dialog (apps/web `share-availability-form.tsx`) with the form's
 * defaults: this week, working hours, slots of 30 minutes or more and every calendar, over the landing's sample week.
 */
export function AvailabilityMockup({ locale, copy, calendars }: { locale: Locale; copy: AvailabilityCopy; calendars: Record<CalendarKey, string> }) {
	const id = useId();
	const today = useToday();
	const weekStart = weekStartFor(locale);
	const thisWeek = today === null ? [] : freeSlots(today, presetRange('thisWeek', today, weekStart));
	// Late in the week no working day is left; "Next week" is what anyone would pick then.
	const range = today !== null && thisWeek.length === 0 ? 'nextWeek' : 'thisWeek';
	const text = today === null ? null : availabilityText(range === 'thisWeek' ? thisWeek : freeSlots(today, presetRange('nextWeek', today, weekStart)), today, locale, copy);
	const weekdays = Array.from({ length: 7 }, (_, offset) => (((weekStart === 0 ? 6 : 0) + offset) % 7) + 1);

	return (
		<div
			role='img'
			aria-label={copy.label}
			className='relative overflow-hidden rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'
		>
			{/* Inert: the replica's fields and buttons look real but can't be focused, clicked or read out. */}
			<div inert className='grid gap-4 select-none'>
				<div className='flex flex-col gap-1'>
					<h3 className='font-heading text-sm font-medium'>{copy.title}</h3>
					<p className='text-xs/relaxed text-muted-foreground'>{copy.description}</p>
				</div>
				<Button className='absolute top-2 right-2' size='icon-sm' variant='ghost'>
					<XIcon />
				</Button>
				<div className='flex flex-col gap-5'>
					<FieldGroup className='gap-4'>
						<FieldSet>
							<FieldLegend variant='label'>{copy.range}</FieldLegend>
							<ToggleGroup className='flex-wrap' size='sm' value={[range]} variant='outline'>
								{RANGES.map(option => (
									<ToggleGroupItem key={option} value={option}>
										{copy.ranges[option]}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</FieldSet>
						<FieldSet>
							<FieldLegend variant='label'>{copy.window}</FieldLegend>
							<div className='flex flex-wrap gap-4'>
								{(
									[
										['windowStart', WORKING_HOURS.start],
										['windowEnd', WORKING_HOURS.end],
									] as const
								).map(([name, hour]) => (
									<Field key={name} className='w-32'>
										<FieldLabel htmlFor={`${id}-${name}`}>{copy[name]}</FieldLabel>
										<Input id={`${id}-${name}`} readOnly type='time' value={pad(hour)} />
									</Field>
								))}
							</div>
						</FieldSet>
						<Field>
							<FieldLegend variant='label'>{copy.days}</FieldLegend>
							<ToggleGroup className='flex-wrap' multiple size='sm' value={WORKING_HOURS.days.map(String)} variant='outline'>
								{weekdays.map(day => (
									<ToggleGroupItem key={day} aria-label={weekdayName(day, locale, 'long')} value={String(day)}>
										{weekdayName(day, locale, 'short')}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-min`}>{copy.minMinutes}</FieldLabel>
							<div className='flex items-center gap-2'>
								<Input className='w-24' id={`${id}-min`} readOnly type='number' value={30} />
								<span className='text-muted-foreground'>{copy.minutes}</span>
							</div>
						</Field>
						<FieldSet>
							<FieldLegend variant='label'>{copy.calendars}</FieldLegend>
							<div className='flex flex-col gap-2'>
								{(Object.keys(CALENDARS) as CalendarKey[]).map(calendar => (
									<Field key={calendar} orientation='horizontal'>
										<Checkbox checked id={`${id}-${calendar}`} />
										<FieldLabel className='font-normal' htmlFor={`${id}-${calendar}`}>
											<span aria-hidden='true' className='size-2.5 shrink-0 rounded-full' style={{ backgroundColor: CALENDARS[calendar] }} />
											{calendars[calendar]}
										</FieldLabel>
									</Field>
								))}
							</div>
						</FieldSet>
					</FieldGroup>
					<section className='flex flex-col gap-2'>
						<h4 className='text-sm font-medium'>{copy.preview}</h4>
						<output className='block min-h-24 rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap'>{text}</output>
					</section>
					<div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
						<Button>
							<CopyIcon aria-hidden='true' />
							{copy.copy}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
