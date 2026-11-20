'use client';

import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import type { Locale } from '@/lib/i18n';

// The charts of apps/web `stats-charts.tsx` with the same classes. The replica is inert, so the tooltips and the
// screen reader tables the app adds are left out: the mockup's label describes it instead.

export function StatsSection({ children, title }: { children: ReactNode; title: string }) {
	return (
		<section className='flex flex-col gap-3'>
			<h4 className='text-sm font-medium'>{title}</h4>
			<div>{children}</div>
		</section>
	);
}

type Series = { color: string; key: string; label: string };

/** Vertical bars per row, one series here; values are minutes and the axis reads in hours. */
export function StackedBars({ rows, series }: { rows: readonly ({ label: string } & Record<string, number | string>)[]; series: readonly Series[] }) {
	const config = Object.fromEntries(series.map(item => [item.key, { color: item.color, label: item.label }])) satisfies ChartConfig;
	return (
		<ChartContainer className='aspect-auto h-52 w-full' config={config}>
			<BarChart accessibilityLayer={false} data={[...rows]} margin={{ left: -16, right: 4, top: 4 }}>
				<CartesianGrid vertical={false} />
				<XAxis axisLine={false} dataKey='label' tickLine={false} tickMargin={8} />
				<YAxis axisLine={false} tickFormatter={(value: number) => String(Math.round(value / 60))} tickLine={false} width={40} />
				{series.map((item, index) => (
					<Bar
						dataKey={item.key}
						fill={`var(--color-${item.key})`}
						key={item.key}
						radius={index === series.length - 1 ? [4, 4, 0, 0] : 0}
						stackId='time'
						stroke='var(--background)'
						strokeWidth={series.length > 1 ? 2 : 0}
					/>
				))}
			</BarChart>
		</ChartContainer>
	);
}

/** Horizontal bars, one per row with its own color and value text, longest first: the share of the largest. */
export function RankedBars({ rows }: { rows: readonly { color: string; detail?: string; key: string; label: string; value: number; valueText: string }[] }) {
	const max = Math.max(1, ...rows.map(row => row.value));
	return (
		<ul className='flex flex-col gap-2.5'>
			{rows.map(row => (
				<li className='flex flex-col gap-1' key={row.key}>
					<div className='flex items-baseline justify-between gap-3 text-sm'>
						<span className='truncate'>{row.label}</span>
						<span className='shrink-0 text-muted-foreground tabular-nums'>
							{row.valueText}
							{row.detail !== undefined && <span className='ml-2 text-xs'>{row.detail}</span>}
						</span>
					</div>
					<div className='h-2 rounded-full bg-muted'>
						<div className='h-full rounded-full' style={{ backgroundColor: row.color, width: `${(row.value / max) * 100}%` }} />
					</div>
				</li>
			))}
		</ul>
	);
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// Grays of the theme's chart scale, in a fixed order, so each part keeps its shade whatever the counts.
const SPLIT_SHADES = ['var(--chart-5)', 'var(--chart-3)', 'var(--chart-1)'] as const;

/** One bar split into parts by count (a 100% bar), with a legend that names every part and its count. */
export function SplitBar({ locale, parts, title }: { locale: Locale; parts: readonly { key: string; label: string; value: number }[]; title: string }) {
	const total = parts.reduce((sum, part) => sum + part.value, 0);
	const number = new Intl.NumberFormat(locale);
	return (
		<div className='flex flex-col gap-2'>
			<span className='text-xs text-muted-foreground'>{title}</span>
			<div className='flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted'>
				{total > 0 &&
					parts.map((part, index) =>
						part.value === 0 ? null : (
							<div
								className='h-full first:rounded-l-full last:rounded-r-full'
								key={part.key}
								style={{ backgroundColor: SPLIT_SHADES[index % SPLIT_SHADES.length], flexGrow: part.value }}
							/>
						)
					)}
			</div>
			<ul className='flex flex-wrap gap-x-4 gap-y-1 text-xs'>
				{parts.map((part, index) => (
					<li className='flex items-center gap-1.5' key={part.key}>
						<span className='size-2.5 rounded-sm' style={{ backgroundColor: SPLIT_SHADES[index % SPLIT_SHADES.length] }} />
						{part.label}
						<span className='text-muted-foreground tabular-nums'>{number.format(part.value)}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

/** Busy time by weekday and hour, darker for busier: one row per weekday, one cell per hour, hours labelled every 3. */
export function Heatmap({ hourLabel, rows }: { hourLabel: (hour: number) => string; rows: readonly { label: string; minutes: readonly number[] }[] }) {
	const max = Math.max(1, ...rows.flatMap(row => row.minutes));
	return (
		<div className='grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px]'>
			{rows.map(row => (
				<div className='contents' key={row.label}>
					<span className='truncate pr-1 leading-4 text-muted-foreground'>{row.label}</span>
					{HOURS.map(hour => {
						const minutes = row.minutes[hour] ?? 0;
						return (
							<span
								className='h-4 rounded-[3px] bg-muted'
								key={hour}
								style={minutes > 0 ? { backgroundColor: `color-mix(in oklch, var(--foreground) ${Math.round(15 + (minutes / max) * 85)}%, transparent)` } : undefined}
							/>
						);
					})}
				</div>
			))}
			<span />
			{HOURS.map(hour => (
				<span className='text-center text-muted-foreground' key={hour}>
					{hour % 3 === 0 ? hourLabel(hour) : ''}
				</span>
			))}
		</div>
	);
}
