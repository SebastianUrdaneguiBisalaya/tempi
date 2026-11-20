'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDuration, formatPercent, formatShortDate } from '@/lib/date-format';
import type { Locale } from '@/lib/i18n';
import { addDays, CALENDARS, type CalendarKey, type EventKey, type WeekStats, weekStartFor, weekStats } from '@/lib/sample-calendar';
import { useToday } from '@/lib/use-today';
import { Heatmap, RankedBars, SplitBar, StackedBars, StatsSection } from './stats-charts';

const PERIODS = ['week', 'month', 'quarter'] as const;

export type StatsCopy = {
	/** Describes the replica for assistive tech, which skips the replica itself. */
	label: string;
	title: string;
	description: string;
	periods: Record<(typeof PERIODS)[number], string>;
	total: string;
	events: string;
	averageDuration: string;
	busiestDay: string;
	occupancy: string;
	focus: string;
	focusHint: string;
	/** With a `{value}` placeholder. */
	change: string;
	noChange: string;
	byCalendar: string;
	heatmap: string;
	venue: { title: string; virtual: string; inPerson: string; none: string };
	recurrence: { title: string; recurring: string; oneOff: string };
	status: { title: string; confirmed: string; tentative: string };
	top: string;
	/** Plural forms with a `{count}` placeholder. */
	topItem: { one: string; other: string };
	nextWeek: string;
};

export type SampleCopy = { calendars: Record<CalendarKey, string>; events: Record<EventKey, string> };

/** One headline number, with how it changed against the previous period when that applies. */
function StatTile({ change, hint, label, value }: { change?: string; hint?: string; label: string; value: string }) {
	return (
		<div className='flex flex-col gap-0.5 rounded-lg border p-3'>
			<span className='text-xs text-muted-foreground'>{label}</span>
			<span className='text-xl font-semibold tabular-nums'>{value}</span>
			{change !== undefined && <span className='text-xs text-muted-foreground'>{change}</span>}
			{hint !== undefined && <span className='text-xs text-muted-foreground'>{hint}</span>}
		</div>
	);
}

/** The report of apps/web `stats-report.tsx` for one week; a single week leaves out the "Time per week" chart. */
function StatsReport({ copy, locale, sample, stats, today }: { copy: StatsCopy; locale: Locale; sample: SampleCopy; stats: WeekStats; today: Date }) {
	const duration = (minutes: number) => formatDuration(minutes, locale);
	const day = (offset: number) => formatShortDate(addDays(today, offset), locale);
	const number = new Intl.NumberFormat(locale);
	const plural = new Intl.PluralRules(locale);
	const change = (current: number, previous: number, format: (value: number) => string) =>
		current === previous ? copy.noChange : copy.change.replace('{value}', `${current > previous ? '+' : '−'}${format(Math.abs(current - previous))}`);
	const weekStart = weekStartFor(locale);
	// Weekday rows in the week's order; the heatmap counts Monday as row 0.
	const weekdays = Array.from({ length: 7 }, (_, offset) => (((weekStart === 0 ? 6 : 0) + offset) % 7) + 1);
	const weekdayName = (weekday: number) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(Date.UTC(2024, 0, weekday));
	const hourName = (hour: number) => new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1, hour));

	return (
		<div className='flex flex-col gap-6'>
			<div className='grid grid-cols-2 gap-2'>
				<StatTile change={change(stats.totals.minutes, stats.previous.minutes, duration)} label={copy.total} value={duration(stats.totals.minutes)} />
				<StatTile change={change(stats.totals.events, stats.previous.events, value => number.format(value))} label={copy.events} value={number.format(stats.totals.events)} />
				<StatTile change={change(stats.totals.averageMinutes, stats.previous.averageMinutes, duration)} label={copy.averageDuration} value={duration(stats.totals.averageMinutes)} />
				{stats.busiestDay !== null && <StatTile hint={duration(stats.busiestDay.minutes)} label={copy.busiestDay} value={day(stats.busiestDay.day)} />}
				<StatTile label={copy.occupancy} value={formatPercent(stats.working.busyMinutes / stats.working.minutes, locale)} />
				<StatTile hint={copy.focusHint} label={copy.focus} value={duration(stats.working.focusMinutes)} />
			</div>

			<StatsSection title={copy.byCalendar}>
				<RankedBars
					rows={stats.byCalendar.map(item => ({
						color: CALENDARS[item.calendar],
						key: item.calendar,
						label: sample.calendars[item.calendar],
						value: item.minutes,
						valueText: duration(item.minutes),
					}))}
				/>
			</StatsSection>

			<StatsSection title={copy.heatmap}>
				<Heatmap hourLabel={hourName} rows={weekdays.map(weekday => ({ label: weekdayName(weekday), minutes: stats.heatmap[weekday - 1] ?? [] }))} />
			</StatsSection>

			<StatsSection title={copy.venue.title}>
				<div className='flex flex-col gap-4'>
					<SplitBar locale={locale} parts={(['virtual', 'inPerson', 'none'] as const).map(key => ({ key, label: copy.venue[key], value: stats.venue[key] }))} title={copy.venue.title} />
					<SplitBar
						locale={locale}
						parts={(['recurring', 'oneOff'] as const).map(key => ({ key, label: copy.recurrence[key], value: stats.recurrence[key] }))}
						title={copy.recurrence.title}
					/>
					<SplitBar locale={locale} parts={(['confirmed', 'tentative'] as const).map(key => ({ key, label: copy.status[key], value: stats.status[key] }))} title={copy.status.title} />
				</div>
			</StatsSection>

			<StatsSection title={copy.top}>
				<RankedBars
					rows={stats.top.map(item => ({
						color: 'var(--chart-3)',
						detail: copy.topItem[plural.select(item.count) === 'one' ? 'one' : 'other'].replace('{count}', number.format(item.count)),
						key: item.key,
						label: sample.events[item.key],
						value: item.minutes,
						valueText: duration(item.minutes),
					}))}
				/>
			</StatsSection>

			<StatsSection title={copy.nextWeek}>
				<StackedBars rows={stats.nextWeek.map(item => ({ busy: item.minutes, label: day(item.day) }))} series={[{ color: 'var(--chart-3)', key: 'busy', label: copy.total }]} />
			</StatsSection>
		</div>
	);
}

/**
 * Static replica of the app's Time stats drawer (apps/web `stats-panel.tsx`) on its "Week" period, over the landing's
 * sample week with working hours on. The report scrolls inside `[data-stats-scroll]`, which the section animates.
 */
export function StatsMockup({ locale, copy, sample }: { locale: Locale; copy: StatsCopy; sample: SampleCopy }) {
	const today = useToday();

	return (
		<div role='img' aria-label={copy.label} className='overflow-hidden rounded-xl border bg-popover text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50'>
			{/* Inert: the replica's period picker looks real but can't be focused, clicked or read out. */}
			<div inert className='flex h-[38rem] flex-col select-none'>
				<div className='flex shrink-0 flex-col gap-1 p-4 pb-0 text-left'>
					<h3 className='font-heading text-sm font-medium text-foreground'>{copy.title}</h3>
					<p className='text-xs/relaxed text-balance text-muted-foreground'>{copy.description}</p>
				</div>
				<div className='flex min-h-0 flex-1 flex-col gap-4 pt-4'>
					<div className='px-4'>
						<ToggleGroup size='sm' value={['week']} variant='outline'>
							{PERIODS.map(option => (
								<ToggleGroupItem key={option} value={option}>
									{copy.periods[option]}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>
					<div data-stats-viewport className='min-h-0 flex-1 overflow-hidden'>
						<div data-stats-scroll className='px-4 pb-6'>
							{today !== null && <StatsReport copy={copy} locale={locale} sample={sample} stats={weekStats(today, weekStartFor(locale))} today={today} />}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
