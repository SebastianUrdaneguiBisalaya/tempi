'use client';

import type { Language } from '@tempi/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatDuration } from '@/lib/date-format';

/** One chart section: a heading over the chart, and a table with the same numbers for screen readers. */
export function StatsSection({ children, table, title }: { children: ReactNode; table?: ReactNode; title: string }) {
	return (
		<section className='flex flex-col gap-3'>
			<h3 className='font-medium text-sm'>{title}</h3>
			<div aria-hidden={table === undefined ? undefined : true}>{children}</div>
			{table}
		</section>
	);
}

/** A table only screen readers see, with the numbers a chart draws. */
export function ScreenReaderTable({ caption, columns, rows }: { caption: string; columns: readonly string[]; rows: readonly (readonly string[])[] }) {
	return (
		<table className='sr-only'>
			<caption>{caption}</caption>
			<thead>
				<tr>
					{columns.map(column => (
						<th key={column} scope='col'>
							{column}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map(row => (
					<tr key={row.join('|')}>
						{row.map((cell, index) =>
							index === 0 ? (
								<th key={columns[index]} scope='row'>
									{cell}
								</th>
							) : (
								<td key={columns[index]}>{cell}</td>
							)
						)}
					</tr>
				))}
			</tbody>
		</table>
	);
}

type Series = { color: string; key: string; label: string };

/**
 * Vertical bars per row, stacked by series (each in its own color, with a legend from two series on) or a single
 * series. Values are minutes; the axis and tooltip read in hours.
 */
export function StackedBars({ language, rows, series }: { language: Language; rows: readonly ({ label: string } & Record<string, number | string>)[]; series: readonly Series[] }) {
	const config = Object.fromEntries(series.map(item => [item.key, { color: item.color, label: item.label }])) satisfies ChartConfig;
	return (
		<ChartContainer className='aspect-auto h-52 w-full' config={config}>
			<BarChart accessibilityLayer={false} data={[...rows]} margin={{ left: -16, right: 4, top: 4 }}>
				<CartesianGrid vertical={false} />
				<XAxis axisLine={false} dataKey='label' tickLine={false} tickMargin={8} />
				<YAxis axisLine={false} tickFormatter={(value: number) => String(Math.round(value / 60))} tickLine={false} width={40} />
				<ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${config[String(name)]?.label ?? name}: ${formatDuration(Number(value), language)}`} />} cursor={false} />
				{series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
				{series.map((item, index) => (
					<Bar
						dataKey={item.key}
						fill={`var(--color-${item.key})`}
						key={item.key}
						// Only the top of the stack is rounded, and a 2px gap separates the segments.
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
export function SplitBar({ parts, title }: { parts: readonly { key: string; label: string; value: number }[]; title: string }) {
	const { i18n } = useTranslation();
	const total = parts.reduce((sum, part) => sum + part.value, 0);
	const number = new Intl.NumberFormat(i18n.language);
	return (
		<div className='flex flex-col gap-2'>
			<span className='text-muted-foreground text-xs'>{title}</span>
			<div aria-hidden='true' className='flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted'>
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
						<span aria-hidden='true' className='size-2.5 rounded-sm' style={{ backgroundColor: SPLIT_SHADES[index % SPLIT_SHADES.length] }} />
						{part.label}
						<span className='text-muted-foreground tabular-nums'>{number.format(part.value)}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

/** Busy time by weekday and hour, darker for busier: one row per weekday, one cell per hour, hours labelled every 3. */
export function Heatmap({
	cellLabel,
	hourLabel,
	rows,
}: {
	cellLabel: (row: string, hour: number, minutes: number) => string;
	hourLabel: (hour: number) => string;
	rows: readonly { label: string; minutes: readonly number[] }[];
}) {
	const max = Math.max(1, ...rows.flatMap(row => row.minutes));
	return (
		<div className='grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px]'>
			{rows.map(row => (
				<div className='contents' key={row.label}>
					<span className='truncate pr-1 text-muted-foreground leading-4'>{row.label}</span>
					{HOURS.map(hour => {
						const minutes = row.minutes[hour] ?? 0;
						return (
							<span
								className='h-4 rounded-[3px] bg-muted'
								key={hour}
								style={minutes > 0 ? { backgroundColor: `color-mix(in oklch, var(--foreground) ${Math.round(15 + (minutes / max) * 85)}%, transparent)` } : undefined}
								title={cellLabel(row.label, hour, minutes)}
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
