'use client';

import { WeatherBackground } from '@useweather/react';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { useToday } from '@/lib/use-today';

export type WeatherCardCopy = {
	city: string;
	condition: string;
	/** With a `{value}` placeholder, e.g. "H {value}". */
	high: string;
	low: string;
	feelsLike: string;
	humidity: string;
	wind: string;
	credit: string;
};

/** An overcast night in Lima, in the units the app's card shows (°C, %, km/h). */
const SAMPLE = { temperature: 17, high: 22, low: 16, feelsLike: 17, humidity: 84, wind: 9 } as const;

/**
 * Like the app's sidebar weather card (apps/web `WeatherCard`): the same `@useweather` background and layout, with fixed
 * sample weather. The animation runs only while the card is on screen.
 */
export function WeatherCardReplica({ locale, copy }: { locale: Locale; copy: WeatherCardCopy }) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	// Numbers are formatted on the client only, like the mockups' dates: Node and browsers space `Intl` units differently.
	const client = useToday() !== null;

	// Follows the card's visibility on the page, so an off-screen canvas spends no frames.
	useEffect(() => {
		const element = ref.current;
		if (element === null) return;
		const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const number = (value: number, unit: 'celsius' | 'kilometer-per-hour' | 'percent') =>
		client
			? new Intl.NumberFormat(locale, { maximumFractionDigits: 0, style: unit === 'percent' ? 'percent' : 'unit', ...(unit === 'percent' ? {} : { unit }) }).format(
					unit === 'percent' ? value / 100 : value
				)
			: ' ';

	return (
		<div className='w-full max-w-sm rounded-xl bg-popover p-2 text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<div ref={ref} className='relative h-52 w-full overflow-hidden rounded-lg'>
				<WeatherBackground condition='overcast' intensity={0.5} paused={!visible} timeOfDay='night' wind={0.3}>
					<div className='flex size-full flex-col justify-between bg-black/15 p-4 text-white'>
						<div className='flex items-start justify-between gap-2'>
							<div className='min-w-0'>
								<p className='truncate text-base font-medium'>{copy.city}</p>
								<p className='truncate text-sm opacity-90'>{copy.condition}</p>
							</div>
							<p className='text-5xl leading-none font-light tabular-nums'>{number(SAMPLE.temperature, 'celsius')}</p>
						</div>
						<div className='flex flex-col gap-1.5 text-xs leading-tight'>
							<p className='flex flex-wrap gap-x-2 opacity-90'>
								<span>{copy.high.replace('{value}', number(SAMPLE.high, 'celsius'))}</span>
								<span>{copy.low.replace('{value}', number(SAMPLE.low, 'celsius'))}</span>
								<span>{copy.feelsLike.replace('{value}', number(SAMPLE.feelsLike, 'celsius'))}</span>
							</p>
							<dl className='flex flex-wrap gap-x-3 opacity-90'>
								<div className='flex gap-1'>
									<dt>{copy.humidity}</dt>
									<dd className='tabular-nums'>{number(SAMPLE.humidity, 'percent')}</dd>
								</div>
								<div className='flex gap-1'>
									<dt>{copy.wind}</dt>
									<dd className='tabular-nums'>{number(SAMPLE.wind, 'kilometer-per-hour')}</dd>
								</div>
							</dl>
							<p className='w-fit opacity-75'>{copy.credit}</p>
						</div>
					</div>
				</WeatherBackground>
			</div>
		</div>
	);
}
