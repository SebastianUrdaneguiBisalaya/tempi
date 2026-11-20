'use client';

import { resolveLanguage, type TimeStats, type WeekStart, weekStartOf } from '@tempi/core';
import { useTranslation } from 'react-i18next';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { formatDuration, formatPercent, formatShortDate } from '@/lib/date-format';
import { toUtcDate } from '@/lib/plain-date';
import { Heatmap, RankedBars, ScreenReaderTable, SplitBar, StackedBars, StatsSection } from './stats-charts';

/** One headline number, with how it changed against the previous period when that applies. */
function StatTile({ change, hint, label, value }: { change?: string; hint?: string; label: string; value: string }) {
	return (
		<div className='flex flex-col gap-0.5 rounded-lg border p-3'>
			<span className='text-muted-foreground text-xs'>{label}</span>
			<span className='font-semibold text-xl tabular-nums'>{value}</span>
			{change !== undefined && <span className='text-muted-foreground text-xs'>{change}</span>}
			{hint !== undefined && <span className='text-muted-foreground text-xs'>{hint}</span>}
		</div>
	);
}

/** Every chart of a period's report; an empty period shows a single message instead. */
export function StatsReport({ stats, weekStart }: { stats: TimeStats; weekStart: WeekStart }) {
	const { i18n, t } = useTranslation();
	const language = resolveLanguage([i18n.language]);
	const { data: calendars } = useCalendars();
	const calendarOf = new Map((calendars ?? []).map(calendar => [calendar.id, calendar]));
	const duration = (minutes: number) => formatDuration(minutes, language);
	const day = (date: string) => formatShortDate(toUtcDate(Temporal.PlainDate.from(date)), { language, timeZone: 'UTC' });
	const number = new Intl.NumberFormat(language);
	const change = (current: number, previous: number, format: (value: number) => string) => {
		if (current === previous) return t('stats.noChange');
		return t('stats.change', { value: `${current > previous ? '+' : '−'}${format(Math.abs(current - previous))}` });
	};

	if (stats.totals.events === 0) return <p className='py-8 text-center text-muted-foreground text-sm'>{t('stats.empty')}</p>;

	const series = stats.byCalendar.map(item => ({
		color: calendarOf.get(item.calendarId)?.color ?? 'var(--muted-foreground)',
		key: item.calendarId,
		label: calendarOf.get(item.calendarId)?.name ?? item.calendarId,
	}));
	const weekRows = stats.weeks.map(week => ({ label: day(week.start), ...Object.fromEntries(week.byCalendar.map(item => [item.calendarId, item.minutes])) }));
	// Weekday rows in the user's week order; the heatmap counts Monday as row 0.
	const firstDay = weekStartOf(Temporal.PlainDate.from('2024-01-01'), weekStart);
	const weekdays = Array.from({ length: 7 }, (_, offset) => firstDay.add({ days: offset }));
	const weekdayName = (date: Temporal.PlainDate, width: 'long' | 'short') => new Intl.DateTimeFormat(language, { timeZone: 'UTC', weekday: width }).format(toUtcDate(date));
	const hourName = (hour: number) => new Intl.DateTimeFormat(language, { hour: 'numeric', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1, hour));

	return (
		<div className='flex flex-col gap-6'>
			<div className='grid grid-cols-2 gap-2'>
				<StatTile change={change(stats.totals.minutes, stats.previous.minutes, duration)} label={t('stats.total')} value={duration(stats.totals.minutes)} />
				<StatTile change={change(stats.totals.events, stats.previous.events, value => number.format(value))} label={t('stats.events')} value={number.format(stats.totals.events)} />
				<StatTile change={change(stats.totals.averageMinutes, stats.previous.averageMinutes, duration)} label={t('stats.averageDuration')} value={duration(stats.totals.averageMinutes)} />
				{stats.busiestDay !== null && <StatTile hint={duration(stats.busiestDay.minutes)} label={t('stats.busiestDay')} value={day(stats.busiestDay.date)} />}
				{stats.working !== null && (
					<>
						<StatTile label={t('stats.occupancy')} value={formatPercent(stats.working.minutes === 0 ? 0 : stats.working.busyMinutes / stats.working.minutes, language)} />
						<StatTile hint={t('stats.focusHint')} label={t('stats.focus')} value={duration(stats.working.focusMinutes)} />
					</>
				)}
			</div>

			<StatsSection title={t('stats.byCalendar')}>
				<RankedBars
					rows={stats.byCalendar.map((item, index) => ({
						color: series[index]?.color ?? '',
						key: item.calendarId,
						label: series[index]?.label ?? '',
						value: item.minutes,
						valueText: duration(item.minutes),
					}))}
				/>
			</StatsSection>

			{stats.weeks.length > 1 && (
				<StatsSection
					table={
						<ScreenReaderTable
							caption={t('stats.weekly')}
							columns={[t('stats.weekday'), ...series.map(item => item.label)]}
							rows={stats.weeks.map(week => [day(week.start), ...series.map(item => duration(week.byCalendar.find(entry => entry.calendarId === item.key)?.minutes ?? 0))])}
						/>
					}
					title={t('stats.weekly')}
				>
					<StackedBars language={language} rows={weekRows} series={series} />
				</StatsSection>
			)}

			<StatsSection
				table={
					<ScreenReaderTable
						caption={t('stats.heatmap')}
						columns={[t('stats.weekday'), t('stats.hour'), t('stats.value')]}
						rows={weekdays.flatMap(date =>
							(stats.heatmap[date.dayOfWeek - 1] ?? []).flatMap((minutes, hour) => (minutes > 0 ? [[weekdayName(date, 'long'), hourName(hour), duration(minutes)]] : []))
						)}
					/>
				}
				title={t('stats.heatmap')}
			>
				<Heatmap
					cellLabel={(row, hour, minutes) => t('stats.heatmapCell', { hour: hourName(hour), value: duration(minutes), weekday: row })}
					hourLabel={hourName}
					rows={weekdays.map(date => ({ label: weekdayName(date, 'short'), minutes: stats.heatmap[date.dayOfWeek - 1] ?? [] }))}
				/>
			</StatsSection>

			<StatsSection title={t('stats.venue.title')}>
				<div className='flex flex-col gap-4'>
					<SplitBar parts={(['virtual', 'inPerson', 'none'] as const).map(key => ({ key, label: t(`stats.venue.${key}`), value: stats.venue[key] }))} title={t('stats.venue.title')} />
					<SplitBar parts={(['recurring', 'oneOff'] as const).map(key => ({ key, label: t(`stats.recurrence.${key}`), value: stats.recurrence[key] }))} title={t('stats.recurrence.title')} />
					<SplitBar parts={(['confirmed', 'tentative'] as const).map(key => ({ key, label: t(`stats.status.${key}`), value: stats.status[key] }))} title={t('stats.status.title')} />
				</div>
			</StatsSection>

			<StatsSection title={t('stats.top')}>
				<RankedBars
					rows={stats.top.map(item => ({
						color: 'var(--chart-3)',
						detail: t('stats.topItem', { count: item.count }),
						key: `${item.title}-${item.count}`,
						label: item.title,
						value: item.minutes,
						valueText: duration(item.minutes),
					}))}
				/>
			</StatsSection>

			<StatsSection
				table={<ScreenReaderTable caption={t('stats.nextWeek')} columns={[t('stats.weekday'), t('stats.value')]} rows={stats.nextWeek.map(item => [day(item.date), duration(item.minutes)])} />}
				title={t('stats.nextWeek')}
			>
				<StackedBars
					language={language}
					rows={stats.nextWeek.map(item => ({ busy: item.minutes, label: day(item.date) }))}
					series={[{ color: 'var(--chart-3)', key: 'busy', label: t('stats.total') }]}
				/>
			</StatsSection>
		</div>
	);
}
