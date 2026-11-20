'use client';

import { cn } from 'cn';
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon, PanelLeftIcon, PanelRightIcon, PlusIcon, SearchIcon, SettingsIcon, VideoIcon } from 'lucide-react';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Hotkey } from '@/features/keyboard/components/hotkey';
import { formatTimeZoneOffset } from '@/lib/date-format';
import { SHOWN_SHORTCUTS } from '@/lib/hotkeys';
import type { Locale } from '@/lib/i18n';
import { ALL_DAY, addDays, at, CALENDARS, type CalendarKey, EVENTS, type EventKey, isoWeekday, NOW_HOUR, WORKING_HOURS, weekStartFor } from '@/lib/sample-calendar';
import { useToday } from '@/lib/use-today';

const FIRST_HOUR = 8;
const LAST_HOUR = 17;
const HOUR_REM = 4;
const UPCOMING = EVENTS.find(event => event.key === 'teamSync');

export type MockupCopy = {
	label: string;
	today: string;
	calendarsTitle: string;
	newCalendar: string;
	default: string;
	readOnly: string;
	calendars: Record<CalendarKey, string>;
	views: { day: string; week: string; month: string };
	searchPlaceholder: string;
	/** With a `{relative}` placeholder, e.g. "Upcoming {relative}". */
	upcoming: string;
	join: string;
	location: string;
	shortcutsHint: string;
	/** The "Ask Tempi" entry at the bottom of the sidebar. */
	assistant: { label: string };
	events: Record<EventKey, string>;
};

/** Same tint as the desktop app's confirmed events (`eventSurface` in apps/web): the calendar color mixed into the background. */
const eventStyle = (color: string): CSSProperties => ({
	backgroundColor: `color-mix(in oklab, ${color} 22%, var(--background))`,
	borderLeftColor: color,
});

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const capitalize = (text: string, locale: Locale) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

type PartProps = { locale: Locale; copy: MockupCopy; today: Date | null };

/**
 * Decorative replica of Tempi's week view (sidebar, header, time grid, right panel) with fixed sample data, built from
 * the same shadcn primitives and classes as apps/web, with working hours on and one secondary time zone set.
 * Every date and time is rendered on the client only: the server
 * doesn't know the visitor's day, and Node and browsers format `Intl` output with different spaces.
 */
export function AppMockup({ locale, copy }: { locale: Locale; copy: MockupCopy }) {
	const today = useToday();

	return (
		<div role='img' aria-label={copy.label} className='@container overflow-hidden rounded-xl border bg-background shadow-2xl shadow-black/50 ring-1 ring-foreground/5'>
			<div aria-hidden className='flex flex-col'>
				<div className='flex h-8 items-center gap-1.5 border-b bg-muted/20 px-3'>
					<span className='size-2.5 rounded-full bg-[#ff5f57]' />
					<span className='size-2.5 rounded-full bg-[#febc2e]' />
					<span className='size-2.5 rounded-full bg-[#28c840]' />
				</div>
				<div className='flex'>
					<Sidebar locale={locale} copy={copy} today={today} />
					<div className='flex min-w-0 flex-1 flex-col'>
						<Header locale={locale} copy={copy} today={today} />
						<div className='flex min-h-0'>
							<WeekGrid locale={locale} copy={copy} today={today} />
							<RightPanel locale={locale} copy={copy} today={today} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function Sidebar({ locale, copy, today }: PartProps) {
	return (
		<aside className='hidden w-56 shrink-0 flex-col gap-5 border-r bg-muted/20 p-3 @4xl:flex'>
			<MiniCalendar locale={locale} today={today} />
			<div className='text-xs'>
				<div className='flex items-center justify-between px-1.5 pb-1'>
					<span className='text-[0.7rem] font-medium text-muted-foreground'>{copy.calendarsTitle}</span>
					<PlusIcon aria-label={copy.newCalendar} className='size-3.5 text-muted-foreground' />
				</div>
				<ul className='flex flex-col gap-0.5'>
					{(Object.keys(CALENDARS) as CalendarKey[]).map(calendar => (
						<li key={calendar} className='flex items-center gap-2 rounded-md px-1.5 py-1.5'>
							<span className='size-3 shrink-0 rounded-sm border-2' style={{ backgroundColor: CALENDARS[calendar], borderColor: CALENDARS[calendar] }} />
							<span className='truncate'>{copy.calendars[calendar]}</span>
							{calendar === 'work' && <span className='shrink-0 text-[0.65rem] text-muted-foreground'>{copy.default}</span>}
							{calendar === 'holidays' && <span className='shrink-0 text-[0.65rem] text-muted-foreground'>{copy.readOnly}</span>}
						</li>
					))}
				</ul>
			</div>
			<AssistantEntry copy={copy.assistant} />
		</aside>
	);
}

/**
 * Replica of the app's "Ask Tempi" entry (apps/web `assistant.tsx`) in dark mode, pinned to the bottom of the sidebar:
 * the logo on a light tile with the glyph inverted, the label and the ⌘J keys.
 */
function AssistantEntry({ copy }: { copy: MockupCopy['assistant'] }) {
	return (
		<div className='mt-auto flex items-center gap-2.5 rounded-lg border border-primary/15 bg-linear-to-br from-primary/10 via-transparent to-transparent p-2 shadow-xs'>
			<span className='flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground shadow-xs'>
				{/* The icon has wide transparent padding: drawn larger than its tile, the dolphin fills it. */}
				<Image src='/tempi-icon.png' alt='' width={48} height={48} className='size-12 max-w-none invert' />
			</span>
			<span className='min-w-0 flex-1 truncate text-xs font-medium'>{copy.label}</span>
			<Hotkey keys={SHOWN_SHORTCUTS.toggleAssistant} />
		</div>
	);
}

function MiniCalendar({ locale, today }: Omit<PartProps, 'copy'>) {
	const weekStart = weekStartFor(locale);
	const first = today && new Date(today.getFullYear(), today.getMonth(), 1);
	const offset = first ? (first.getDay() - weekStart + 7) % 7 : 0;
	const weekdays = today ? weekDays(locale, today).map(day => capitalize(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day).slice(0, 2), locale)) : [];
	const visibleWeek = today ? weekDays(locale, today) : [];

	return (
		<div className='text-xs'>
			<p className='mb-2 h-4 px-1 font-medium'>{today && capitalize(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(today), locale)}</p>
			<div className='grid grid-cols-7 text-center'>
				{Array.from({ length: 7 }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size header row.
					<span key={index} className='h-5 text-[0.65rem] text-muted-foreground'>
						{weekdays[index]}
					</span>
				))}
				{Array.from({ length: 42 }, (_, index) => {
					const day = first && addDays(first, index - offset);
					const isToday = day !== null && today !== null && sameDay(day, today);
					const inWeek = day !== null && visibleWeek.some(shown => sameDay(shown, day));
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size grid, always 42 cells.
							key={index}
							className={cn(
								'flex h-6 items-center justify-center text-[0.7rem]',
								day && today && day.getMonth() !== today.getMonth() && 'text-muted-foreground/50',
								inWeek && 'bg-accent text-accent-foreground'
							)}
						>
							<span className={cn('flex size-6 items-center justify-center rounded-md', isToday && 'bg-primary font-medium text-primary-foreground')}>{day?.getDate()}</span>
						</span>
					);
				})}
			</div>
		</div>
	);
}

function Header({ locale, copy, today }: PartProps) {
	return (
		<header className='flex items-center gap-2 border-b px-3 py-2'>
			<span className='hidden size-7 items-center justify-center text-muted-foreground @4xl:flex'>
				<PanelLeftIcon className='size-3.5' />
			</span>
			<span className='hidden size-6 items-center justify-center rounded-full bg-muted text-[0.6rem] font-medium @xl:flex'>TP</span>
			<span className='flex h-7 items-center rounded-md border px-2 text-xs font-medium dark:bg-input/30'>{copy.today}</span>
			<ChevronLeftIcon className='size-3.5 text-muted-foreground' />
			<ChevronRightIcon className='size-3.5 text-muted-foreground' />
			<span className='min-w-0 flex-1 truncate font-heading text-base font-semibold @xl:text-xl'>
				{today && capitalize(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(today), locale)}
			</span>
			<ToggleGroup value={['week']} variant='outline' className='hidden @xl:flex'>
				{(['day', 'week', 'month'] as const).map(view => (
					<ToggleGroupItem key={view} value={view} tabIndex={-1}>
						{copy.views[view]}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<span className='hidden size-7 items-center justify-center text-muted-foreground @xl:flex'>
				<SettingsIcon className='size-3.5' />
			</span>
			{/* Like the app, the toggle for the Upcoming panel is always there, even when the panel doesn't fit. */}
			<span className='flex size-7 shrink-0 items-center justify-center text-muted-foreground'>
				<PanelRightIcon className='size-3.5' />
			</span>
		</header>
	);
}

function weekDays(locale: Locale, today: Date) {
	const weekStart = weekStartFor(locale);
	const first = addDays(today, -((today.getDay() - weekStart + 7) % 7));
	return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/** Like the app's working hours (Settings › Calendar), the time grid shades every hour outside them. */
const isOffHours = (day: Date, hour: number) => !WORKING_HOURS.days.some(weekday => weekday === isoWeekday(day)) || hour < WORKING_HOURS.start || hour >= WORKING_HOURS.end;

// The one secondary time zone shown (Settings › Calendar): the first whose offset differs from the visitor's today.
const SECONDARY_ZONES = ['Europe/London', 'America/New_York', 'Asia/Tokyo'] as const;

const secondaryZone = (today: Date, locale: Locale) => SECONDARY_ZONES.find(zone => formatTimeZoneOffset(today, locale, zone) !== formatTimeZoneOffset(today, locale));

/** Like the app's extra hour column: the hour alone when the zone is on the hour, else the time (e.g. "9:30" in India). */
const zoneHour = (instant: Date, locale: Locale, timeZone: string) => {
	const onHour = new Intl.DateTimeFormat('en', { minute: 'numeric', timeZone }).format(instant) === '0';
	return new Intl.DateTimeFormat(locale, onHour ? { hour: 'numeric', timeZone } : { hour: 'numeric', minute: '2-digit', timeZone }).format(instant);
};

/** A zone name over its hour column, as the app's time grid writes it (e.g. "GMT+1"); narrow mockups drop the extra zone. */
function ZoneName({ name }: { name: string | undefined }) {
	return <div className='hidden w-12 shrink-0 items-end justify-end pr-2 pb-1 text-[0.6rem] text-muted-foreground @xl:flex'>{name}</div>;
}

function WeekGrid({ locale, copy, today }: PartProps) {
	const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => FIRST_HOUR + index);
	const days = today ? weekDays(locale, today) : Array.from({ length: 7 }, () => null);
	const todayIndex = today ? days.findIndex(day => day !== null && sameDay(day, today)) : 0;
	const top = (hour: number) => `${(hour - FIRST_HOUR) * HOUR_REM}rem`;
	const hourLabel = new Intl.DateTimeFormat(locale, { hour: 'numeric' });
	const range = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
	const zone = today ? secondaryZone(today, locale) : undefined;

	return (
		<div className='flex min-w-0 flex-1 flex-col'>
			<div className='flex border-b'>
				{today && zone && <ZoneName name={formatTimeZoneOffset(today, locale, zone)} />}
				<ZoneName name={today && zone ? formatTimeZoneOffset(today, locale) : undefined} />
				<div className='w-12 shrink-0 @xl:hidden' />
				{days.map((day, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: the week always has seven positional columns.
						key={index}
						// Narrow mockups show today and its neighbours, like a three-day view.
						className={cn('flex h-9 flex-1 items-center justify-center gap-1.5 border-l text-xs', Math.abs(index - todayIndex) > 1 && 'hidden @2xl:flex')}
					>
						{today && day && (
							<>
								<span className={cn('text-muted-foreground', index === todayIndex && 'font-medium text-foreground')}>
									{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day)}
								</span>
								{index === todayIndex ? <Badge>{day.getDate()}</Badge> : <span className='font-medium'>{day.getDate()}</span>}
							</>
						)}
					</div>
				))}
			</div>
			{/* All-day lane: one public holiday from the read-only calendar. */}
			<div className='flex border-b'>
				{zone && <div className='hidden w-12 shrink-0 @xl:block' />}
				<div className='w-12 shrink-0' />
				{days.map((_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: positional columns.
					<div key={index} className={cn('flex-1 border-l p-0.5', Math.abs(index - todayIndex) > 1 && 'hidden @2xl:block')}>
						{index === todayIndex + ALL_DAY.day && (
							<div data-mockup-event className='truncate rounded-sm border-l-[3px] px-1.5 py-0.5 text-[0.7rem] font-medium' style={eventStyle(CALENDARS[ALL_DAY.calendar])}>
								{copy.events[ALL_DAY.key]}
							</div>
						)}
						{index !== todayIndex + ALL_DAY.day && <div className='h-5' />}
					</div>
				))}
			</div>
			<div className='relative flex' style={{ height: `${hours.length * HOUR_REM}rem` }}>
				{today && zone && (
					<div className='hidden w-12 shrink-0 @xl:block'>
						{hours.map(hour => (
							<div key={hour} className='pr-2 text-right text-[0.65rem] text-muted-foreground' style={{ height: `${HOUR_REM}rem` }}>
								{hour > FIRST_HOUR && <span className='relative -top-2'>{zoneHour(at(today, hour), locale, zone)}</span>}
							</div>
						))}
					</div>
				)}
				<div className='w-12 shrink-0'>
					{hours.map(hour => (
						<div key={hour} className='pr-2 text-right text-[0.65rem] text-muted-foreground' style={{ height: `${HOUR_REM}rem` }}>
							{today && hour > FIRST_HOUR && <span className='relative -top-2'>{hourLabel.format(at(today, hour))}</span>}
						</div>
					))}
				</div>
				{days.map((day, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: positional columns.
						key={index}
						className={cn('relative flex-1 border-l', Math.abs(index - todayIndex) > 1 && 'hidden @2xl:block')}
					>
						{hours.map(hour => (
							<div key={hour} className={cn(hour > FIRST_HOUR && 'border-t', day && isOffHours(day, hour) && 'bg-muted/60')} style={{ height: `${HOUR_REM}rem` }} />
						))}
						{EVENTS.filter(event => index === todayIndex + event.day).map(event => (
							<div
								key={`${event.day}-${event.key}`}
								data-mockup-event
								// Like the app, events shorter than an hour put the time next to the title so both fit on one line.
								className={cn(
									'absolute inset-x-0.5 flex overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-[0.7rem]/tight shadow-[0_0_0_1px_var(--background)]',
									event.end - event.start < 1 ? 'flex-row items-baseline gap-1' : 'flex-col'
								)}
								style={{ top: top(event.start), height: `${(event.end - event.start) * HOUR_REM}rem`, ...eventStyle(CALENDARS[event.calendar]) }}
							>
								<span className='truncate font-medium'>{copy.events[event.key]}</span>
								<span className='truncate text-muted-foreground'>{today && day && range.formatRange(at(day, event.start), at(day, event.end))}</span>
							</div>
						))}
						{index === todayIndex && (
							<div data-mockup-now className='pointer-events-none absolute inset-x-0 z-10 h-0' style={{ top: top(NOW_HOUR) }}>
								<div className='absolute inset-x-0 -top-px h-0.5 bg-destructive' />
								<div className='absolute -top-1.5 -left-1.5 size-3 rounded-full bg-destructive' />
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

function RightPanel({ locale, copy, today }: PartProps) {
	if (UPCOMING === undefined) return null;
	const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(Math.round((UPCOMING.start - NOW_HOUR) * 60), 'minute');
	const range = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });

	return (
		<aside className='hidden w-60 shrink-0 flex-col border-l @6xl:flex'>
			<div className='flex min-h-12 items-center gap-2 border-b px-3 text-xs text-muted-foreground'>
				<SearchIcon className='size-3.5' />
				{copy.searchPlaceholder}
			</div>
			<div className='flex flex-1 flex-col gap-3 p-3 text-xs'>
				<p className='font-heading text-sm font-semibold'>{today ? copy.upcoming.replace('{relative}', relative) : ' '}</p>
				<div className='flex flex-col gap-2 rounded-lg border p-3'>
					<span className='flex min-w-0 items-center gap-2'>
						<span className='size-2 shrink-0 rounded-full' style={{ backgroundColor: CALENDARS[UPCOMING.calendar] }} />
						<span className='truncate font-medium'>{copy.events[UPCOMING.key]}</span>
					</span>
					<span className='h-4 text-muted-foreground'>{today && range.formatRange(at(today, UPCOMING.start), at(today, UPCOMING.end))}</span>
					<span className='flex items-center gap-1 text-muted-foreground'>
						<MapPinIcon className='size-3 shrink-0' />
						<span className='truncate'>{copy.location}</span>
					</span>
					<span className='flex h-6 items-center justify-center gap-1 rounded-md bg-primary text-xs font-medium text-primary-foreground'>
						<VideoIcon className='size-3' />
						{copy.join}
					</span>
				</div>
			</div>
			<p className='flex items-center justify-between gap-1.5 px-3 py-2 text-xs text-muted-foreground'>
				{copy.shortcutsHint} <Kbd>?</Kbd>
			</p>
		</aside>
	);
}
