'use client';

import { weatherScene } from '@tempi/core';
import { WeatherBackground } from '@useweather/react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useDocumentVisible } from '@/hooks/use-document-visible';
import { useWeather } from '../hooks/use-weather';

/** Every card has this height, loading or not, so the sidebar never jumps. */
const CARD_HEIGHT = 'h-36';

const OPEN_METEO_URL = 'https://open-meteo.com/';

/**
 * The weather card above the assistant entry. Mounted only while the integration is on, so turning it off releases
 * the animation and stops every request.
 */
export function WeatherEntry() {
	const { data: settings } = useSettings();
	return settings?.weatherEnabled === true ? <WeatherCard /> : null;
}

function WeatherCard() {
	const { i18n, t } = useTranslation();
	const visible = useDocumentVisible();
	const { data: weather, isPending } = useWeather();

	if (isPending) return <Skeleton className={`${CARD_HEIGHT} w-full rounded-lg`} />;
	// No place to show (no time zone city, nothing found), or the first request failed: the error toast already said so.
	if (weather === null || weather === undefined) return null;

	const { conditions, location } = weather;
	// Read at render: the scene's light follows the hour each time the weather refreshes.
	const scene = weatherScene(conditions, new Date());
	const number = (value: number | null, unit: 'celsius' | 'kilometer-per-hour' | 'percent') =>
		value === null
			? '—'
			: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0, style: unit === 'percent' ? 'percent' : 'unit', ...(unit === 'percent' ? {} : { unit }) }).format(
					unit === 'percent' ? value / 100 : value
				);

	return (
		<section aria-label={t('weather.label', { city: location.name })} className={`relative ${CARD_HEIGHT} w-full overflow-hidden rounded-lg`}>
			<WeatherBackground condition={scene.condition} intensity={scene.intensity} paused={!visible} timeOfDay={scene.timeOfDay} wind={scene.wind}>
				{/* A soft shade keeps small white text readable on bright skies; no backdrop blur, which would redraw every frame. */}
				<div className='flex size-full flex-col justify-between bg-black/15 p-3 text-white'>
					<div className='flex items-start justify-between gap-2'>
						<div className='min-w-0'>
							<p className='truncate text-sm font-medium' title={location.region ?? undefined}>
								{location.name}
							</p>
							<p className='truncate text-xs opacity-90'>{t(`weather.conditions.${scene.condition}`)}</p>
						</div>
						<p className='text-3xl font-light leading-none tabular-nums'>{number(conditions.temperature, 'celsius')}</p>
					</div>
					<div className='flex flex-col gap-1 text-[11px] leading-tight'>
						<p className='flex flex-wrap gap-x-2 opacity-90'>
							<span>{t('weather.high', { value: number(conditions.high, 'celsius') })}</span>
							<span>{t('weather.low', { value: number(conditions.low, 'celsius') })}</span>
							<span>{t('weather.feelsLike', { value: number(conditions.apparentTemperature, 'celsius') })}</span>
						</p>
						<dl className='flex flex-wrap gap-x-3 opacity-90'>
							<div className='flex gap-1'>
								<dt>{t('weather.humidity')}</dt>
								<dd className='tabular-nums'>{number(conditions.humidity, 'percent')}</dd>
							</div>
							<div className='flex gap-1'>
								<dt>{t('weather.wind')}</dt>
								<dd className='tabular-nums'>{number(conditions.windSpeed, 'kilometer-per-hour')}</dd>
							</div>
						</dl>
						{/* Open-Meteo's data is CC BY 4.0: the credit stays visible. The main process opens it in the browser. */}
						<a className='w-fit rounded-sm opacity-75 underline-offset-2 hover:underline hover:opacity-100' href={OPEN_METEO_URL} rel='noreferrer' target='_blank'>
							{t('weather.credit')}
						</a>
					</div>
				</div>
			</WeatherBackground>
		</section>
	);
}
