'use client';

import { cn } from 'cn';
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon, MapPinIcon, PlusIcon, SearchIcon, UtensilsIcon, VideoIcon } from 'lucide-react';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { useSyncExternalStore } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Locale } from '@/lib/i18n';

const CALENDARS = {
	work: '#3b82f6',
	personal: '#22c55e',
	project: '#8b5cf6',
	holidays: '#f97316',
} as const;

type CalendarKey = keyof typeof CALENDARS;

const EVENTS = [
	{ key: 'teamSync', calendar: 'work', start: 8, end: 9, icon: VideoIcon },
	{ key: 'designReview', calendar: 'work', start: 10, end: 11, icon: MapPinIcon },
	{ key: 'lunch', calendar: 'personal', start: 13, end: 14, icon: UtensilsIcon },
	{ key: 'docs', calendar: 'project', start: 14.5, end: 15.5, icon: FileTextIcon },
] as const satisfies readonly { key: string; calendar: CalendarKey; start: number; end: number; icon: unknown }[];

const FIRST_HOUR = 8;
const LAST_HOUR = 16;
const HOUR_REM = 3;
// Where the red "now" line sits; fixed so the mockup always tells the same story.
const NOW_HOUR = 11.5;

export type MockupCopy = {
	label: string;
	calendars: Record<CalendarKey, string>;
	readOnly: string;
	addCalendar: string;
	search: string;
	views: { day: string; week: string; month: string };
	events: Record<(typeof EVENTS)[number]['key'], string>;
};

// The date only changes at midnight; reading it once per visit is enough.
const subscribe = () => () => {
	// Nothing to unsubscribe from.
};
const todayKey = () => new Date().toDateString();

/** Same tint as the desktop app's confirmed events (`eventSurface` in apps/web): the calendar color mixed into the background. */
const eventStyle = (color: string): CSSProperties => ({
	backgroundColor: `color-mix(in oklab, ${color} 22%, var(--background))`,
	borderLeftColor: color,
});

const at = (date: Date, hour: number) => {
	const copy = new Date(date);
	copy.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
	return copy;
};

const capitalize = (text: string, locale: Locale) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

/** Decorative replica of Tempi's day view with fixed sample data, built from the same shadcn primitives as apps/web. */
export function AppMockup({ locale, copy }: { locale: Locale; copy: MockupCopy }) {
	// Unknown while prerendering: the dates fill in on the client, so "today" is always the visitor's today.
	const key = useSyncExternalStore(subscribe, todayKey, () => null);
	const today = key === null ? null : new Date(key);

	return (
		<div role='img' aria-label={copy.label} className='@container overflow-hidden rounded-xl border bg-background shadow-2xl shadow-black/50 ring-1 ring-foreground/5'>
			<div aria-hidden className='flex'>
				<Sidebar locale={locale} copy={copy} today={today} />
				<div className='min-w-0 flex-1'>
					<header className='flex items-center gap-2 border-b px-3 py-2.5'>
						<span className='hidden size-7 items-center justify-center text-muted-foreground @xl:flex'>
							<ChevronLeftIcon className='size-4' />
						</span>
						<span className='hidden size-7 items-center justify-center text-muted-foreground @xl:flex'>
							<ChevronRightIcon className='size-4' />
						</span>
						<span className='min-w-0 flex-1 truncate font-heading text-base font-semibold'>
							{today && capitalize(new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(today), locale)}
						</span>
						<ToggleGroup value={['day']} variant='outline' tabIndex={-1}>
							{(['day', 'week', 'month'] as const).map(view => (
								<ToggleGroupItem key={view} value={view} tabIndex={-1}>
									{copy.views[view]}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</header>
					<DayGrid locale={locale} copy={copy} today={today} />
				</div>
			</div>
		</div>
	);
}

type PartProps = { locale: Locale; copy: MockupCopy; today: Date | null };

function Sidebar({ locale, copy, today }: PartProps) {
	return (
		<aside className='hidden w-52 shrink-0 flex-col gap-4 border-r bg-muted/20 p-3 @xl:flex'>
			<div className='flex items-center gap-1.5'>
				<span className='size-2.5 rounded-full bg-[#ff5f57]' />
				<span className='size-2.5 rounded-full bg-[#febc2e]' />
				<span className='size-2.5 rounded-full bg-[#28c840]' />
			</div>
			<Image src='/tempi-icon.png' alt='' width={36} height={36} className='-my-2 -ml-2 size-9' />
			<MiniCalendar locale={locale} today={today} />
			<ul className='flex flex-col gap-0.5 text-xs'>
				{(Object.keys(CALENDARS) as CalendarKey[]).map(calendar => (
					<li key={calendar} className='flex items-center gap-2 rounded-md px-1.5 py-1.5'>
						<span className='size-3 shrink-0 rounded-sm border-2' style={{ backgroundColor: CALENDARS[calendar], borderColor: CALENDARS[calendar] }} />
						<span className='truncate'>{copy.calendars[calendar]}</span>
						{calendar === 'holidays' && <span className='shrink-0 text-[0.65rem] text-muted-foreground'>{copy.readOnly}</span>}
					</li>
				))}
				<li className='flex items-center gap-2 px-1.5 py-1.5 text-muted-foreground'>
					<PlusIcon className='size-3' />
					{copy.addCalendar}
				</li>
			</ul>
			<div className='mt-auto flex items-center gap-2 rounded-md border bg-input/30 px-2 py-1.5 text-xs text-muted-foreground'>
				<SearchIcon className='size-3.5' />
				<span className='flex-1'>{copy.search}</span>
				<Kbd>⌘K</Kbd>
			</div>
		</aside>
	);
}

function MiniCalendar({ locale, today }: Omit<PartProps, 'copy'>) {
	const weekStart = locale === 'es' ? 1 : 0;
	// Weekday initials from a known Sunday, rotated to the locale's first day.
	const weekdays = Array.from({ length: 7 }, (_, index) => {
		const day = new Date(2024, 0, 7 + ((index + weekStart) % 7));
		return capitalize(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day).slice(0, 2), locale);
	});

	const days: (Date | null)[] = Array.from({ length: 42 }, (_, index) => {
		if (today === null) return null;
		const first = new Date(today.getFullYear(), today.getMonth(), 1);
		const offset = (first.getDay() - weekStart + 7) % 7;
		return new Date(today.getFullYear(), today.getMonth(), 1 - offset + index);
	});

	return (
		<div className='text-xs'>
			<p className='mb-2 px-1 font-medium'>{today && capitalize(new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(today), locale)}</p>
			<div className='grid grid-cols-7 text-center'>
				{weekdays.map(weekday => (
					<span key={weekday} className='py-1 text-[0.65rem] text-muted-foreground'>
						{weekday}
					</span>
				))}
				{days.map((day, index) => {
					const isToday = day !== null && today !== null && day.toDateString() === today.toDateString();
					const outside = day !== null && today !== null && day.getMonth() !== today.getMonth();
					return (
						<span
							// Cells are positional: the grid always has 42 of them.
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size grid.
							key={index}
							className={cn(
								'mx-auto flex size-6 items-center justify-center rounded-md text-[0.7rem]',
								outside && 'text-muted-foreground/50',
								isToday && 'bg-primary font-medium text-primary-foreground'
							)}
						>
							{day?.getDate()}
						</span>
					);
				})}
			</div>
		</div>
	);
}

function DayGrid({ locale, copy, today }: PartProps) {
	const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => FIRST_HOUR + index);
	// Any date works for labels; today keeps them consistent with the header once known.
	const base = today ?? new Date(2026, 0, 1);
	const hourLabel = new Intl.DateTimeFormat(locale, { hour: 'numeric' });
	const range = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
	const top = (hour: number) => `${(hour - FIRST_HOUR) * HOUR_REM}rem`;

	return (
		<div className='relative flex' style={{ height: `${hours.length * HOUR_REM}rem` }}>
			<div className='w-14 shrink-0'>
				{hours.map(hour => (
					<div key={hour} className='relative pr-2 text-right text-[0.7rem] text-muted-foreground' style={{ height: `${HOUR_REM}rem` }}>
						{hour > FIRST_HOUR && <span className='relative -top-2'>{hourLabel.format(at(base, hour))}</span>}
					</div>
				))}
			</div>
			<div className='relative flex-1 border-l'>
				{hours.map(hour => (
					<div key={hour} className={cn('border-b border-border/60', hour === FIRST_HOUR && 'border-t-0')} style={{ height: `${HOUR_REM}rem` }} />
				))}
				{EVENTS.map(event => {
					const Icon = event.icon;
					return (
						<div
							key={event.key}
							data-mockup-event
							className='absolute inset-x-1.5 flex items-start justify-between gap-2 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-xs/tight shadow-[0_0_0_1px_var(--background)]'
							style={{ top: top(event.start), height: `calc(${(event.end - event.start) * HOUR_REM}rem - 2px)`, ...eventStyle(CALENDARS[event.calendar]) }}
						>
							<span className='flex min-w-0 flex-col'>
								<span className='truncate font-medium'>{copy.events[event.key]}</span>
								<span className='truncate text-muted-foreground'>{range.formatRange(at(base, event.start), at(base, event.end))}</span>
							</span>
							<Icon className='mt-0.5 size-3.5 shrink-0 text-foreground/70' />
						</div>
					);
				})}
				<div data-mockup-now className='pointer-events-none absolute inset-x-0 h-0' style={{ top: top(NOW_HOUR) }}>
					<div className='absolute inset-x-0 -top-px h-0.5 bg-destructive' />
					<div className='absolute -top-1.5 -left-1.5 size-3 rounded-full bg-destructive' />
				</div>
			</div>
		</div>
	);
}
