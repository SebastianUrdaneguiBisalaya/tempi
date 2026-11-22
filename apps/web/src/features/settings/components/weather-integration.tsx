'use client';

import { type WeatherLocation, weatherLocationQuerySchema } from '@tempi/core';
import { ChevronsUpDownIcon, CloudSunIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { useWeather, useWeatherLocationSearch } from '@/features/weather/hooks/use-weather';
import { useSaveSettings, useSettings } from '../hooks/use-settings';

const OPEN_METEO_URL = 'https://open-meteo.com/';

const placeLabel = (place: WeatherLocation) => (place.region === null ? place.name : `${place.name}, ${place.region}`);

/** Turns the sidebar weather on or off and picks its city, searched through Open-Meteo's geocoding. */
export function WeatherIntegration() {
	const { t } = useTranslation();
	const id = useId();
	const { data: settings } = useSettings();
	const save = useSaveSettings();
	if (settings === undefined) return null;

	return (
		<section aria-labelledby={`${id}-title`}>
			<Card size='sm'>
				<CardHeader>
					<div className='flex items-center gap-3'>
						<CloudSunIcon aria-hidden className='size-8 shrink-0 text-muted-foreground' />
						<div className='flex min-w-0 flex-col gap-0.5'>
							<CardTitle>
								<h3 id={`${id}-title`}>{t('settings.integrations.weather.title')}</h3>
							</CardTitle>
							<CardDescription>{t('settings.integrations.weather.description')}</CardDescription>
						</div>
					</div>
					<CardAction>
						<Switch
							aria-label={t('settings.integrations.weather.enabled')}
							checked={settings.weatherEnabled}
							disabled={save.isPending}
							onCheckedChange={checked => save.mutate({ weatherEnabled: checked })}
						/>
					</CardAction>
				</CardHeader>
				<CardContent className='flex flex-col items-start gap-4'>
					{settings.weatherEnabled && <CityField chosen={settings.weatherLocation} id={`${id}-city`} onChoose={location => save.mutate({ weatherLocation: location })} />}
					<p className='text-muted-foreground'>{t('settings.integrations.weather.privacy')}</p>
					{/* Open-Meteo's data is CC BY 4.0: credit it where the integration is described. */}
					<a className='rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline' href={OPEN_METEO_URL} rel='noreferrer' target='_blank'>
						{t('settings.integrations.weather.credit')}
					</a>
				</CardContent>
			</Card>
		</section>
	);
}

function CityField({ chosen, id, onChoose }: { chosen: WeatherLocation | null; id: string; onChoose: (location: WeatherLocation) => void }) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const search = useWeatherLocationSearch(query);
	// Until a city is chosen, the card shows the time zone's: name it, so the user knows what they are replacing.
	const { data: weather } = useWeather();
	const proposed = chosen === null ? (weather?.location ?? null) : null;
	const typed = weatherLocationQuerySchema.safeParse(query).success;
	const results = typed ? (search.data ?? []) : [];

	return (
		<Field className='w-full sm:w-80'>
			<FieldLabel htmlFor={id}>{t('settings.integrations.weather.location')}</FieldLabel>
			<Popover
				onOpenChange={next => {
					setOpen(next);
					if (!next) setQuery('');
				}}
				open={open}
			>
				<PopoverTrigger
					render={
						<Button aria-expanded={open} className='w-full justify-between font-normal' id={id} role='combobox' variant='outline'>
							<span className={chosen === null ? 'truncate text-muted-foreground' : 'truncate'}>
								{chosen === null ? t('settings.integrations.weather.locationPlaceholder') : placeLabel(chosen)}
							</span>
							<ChevronsUpDownIcon aria-hidden='true' className='text-muted-foreground' />
						</Button>
					}
				/>
				<PopoverContent align='start' className='w-(--anchor-width) min-w-64 p-0'>
					{/* Open-Meteo already ranks the places; filtering them again here would hide namesakes. */}
					<Command shouldFilter={false}>
						<CommandInput onValueChange={setQuery} placeholder={t('settings.integrations.weather.locationSearch')} value={query} />
						<CommandList>
							{!typed ? (
								<p className='px-3 py-4 text-center text-muted-foreground'>{t('settings.integrations.weather.locationHint')}</p>
							) : search.isFetching && results.length === 0 ? (
								<div className='flex justify-center py-4'>
									<Spinner />
								</div>
							) : (
								<CommandEmpty>{t('settings.integrations.weather.locationEmpty')}</CommandEmpty>
							)}
							<CommandGroup>
								{results.map(place => (
									<CommandItem
										key={`${place.latitude},${place.longitude}`}
										onSelect={() => {
											onChoose(place);
											setOpen(false);
											setQuery('');
										}}
										value={`${place.latitude},${place.longitude}`}
									>
										<span className='truncate'>{placeLabel(place)}</span>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{proposed !== null && <FieldDescription>{t('settings.integrations.weather.locationProposed', { city: placeLabel(proposed) })}</FieldDescription>}
		</Field>
	);
}
