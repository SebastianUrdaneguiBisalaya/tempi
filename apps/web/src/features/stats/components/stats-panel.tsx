'use client';

import { DEFAULT_SETTINGS, weekStartOf } from '@tempi/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useTimeStats } from '../hooks/use-time-stats';
import { StatsReport } from './stats-report';

const PERIODS = ['week', 'month', 'quarter'] as const;
type Period = (typeof PERIODS)[number];

/** The days a period covers around today: its week, its month, or its month and the two before. */
const periodDates = (period: Period, today: Temporal.PlainDate, weekStart: Parameters<typeof weekStartOf>[1]) => {
	if (period === 'week') {
		const start = weekStartOf(today, weekStart);
		return { from: start.toString(), to: start.add({ days: 6 }).toString() };
	}
	const monthStart = today.with({ day: 1 });
	const lastDay = monthStart.add({ months: 1 }).subtract({ days: 1 });
	return { from: (period === 'month' ? monthStart : monthStart.subtract({ months: 2 })).toString(), to: lastDay.toString() };
};

/** The period picker over the report of the visible calendars. */
export function StatsPanel() {
	const { t } = useTranslation();
	const timeZone = useTimeZone();
	const { today } = useCalendarNavigation();
	const { data: settings } = useSettings();
	const { weekStart } = settings ?? DEFAULT_SETTINGS;
	const [period, setPeriod] = useState<Period>('week');
	const day = today ?? Temporal.Now.plainDateISO(timeZone);
	const stats = useTimeStats(periodDates(period, day, weekStart));

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-4'>
			<div className='px-4'>
				<ToggleGroup
					aria-label={t('stats.title')}
					onValueChange={([selected]) => {
						const next = PERIODS.find(option => option === selected);
						if (next !== undefined) setPeriod(next);
					}}
					size='sm'
					value={[period]}
					variant='outline'
				>
					{PERIODS.map(option => (
						<ToggleGroupItem key={option} value={option}>
							{t(`stats.periods.${option}`)}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</div>
			<ScrollArea className='min-h-0 flex-1'>
				<div aria-busy={stats.isFetching || undefined} className='px-4 pb-6'>
					{stats.data === undefined ? (
						<div className='flex items-center gap-2 py-8 text-muted-foreground text-sm'>
							<Spinner />
							{t('stats.loading')}
						</div>
					) : (
						<StatsReport stats={stats.data} weekStart={weekStart} />
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
