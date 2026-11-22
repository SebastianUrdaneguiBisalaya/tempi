'use client';

import { useQuery } from '@tanstack/react-query';
import { weatherLocationQuerySchema } from '@tempi/core';
import { useEffect, useState } from 'react';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** How often the weather is asked again while it is on screen. Open-Meteo updates its current values every 15 minutes. */
export const WEATHER_REFRESH_MS = 30 * 60 * 1000;

/** How long typing must pause before a city search is sent, so each keystroke isn't a request. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The current weather for the card: the place picked in Settings or the city of the time zone; null when there is
 * none or the integration is off. Refreshed every 30 minutes while mounted and the window is visible.
 */
export const useWeather = () => {
	const api = useApi();
	const { data: settings } = useSettings();
	const timeZone = useTimeZone();
	const enabled = settings?.weatherEnabled === true;
	return useQuery({
		enabled: api !== null && enabled,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.weather.current());
		},
		queryKey: queryKeys.weather.current({ location: settings?.weatherLocation ?? null, timeZone }),
		refetchInterval: WEATHER_REFRESH_MS,
	});
};

/** Places matching `query`, asked once typing pauses and only for a valid search (two characters or more). */
export const useWeatherLocationSearch = (query: string) => {
	const api = useApi();
	const [settled, setSettled] = useState(query);
	// The pause is a timer outside React: it decides when the typed text becomes a request.
	useEffect(() => {
		const timer = setTimeout(() => setSettled(query), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [query]);
	const search = weatherLocationQuerySchema.safeParse(settled);
	return useQuery({
		enabled: api !== null && search.success,
		queryFn: async () => {
			if (api === null || !search.success) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.weather.searchLocations(search.data));
		},
		queryKey: queryKeys.weather.search(search.success ? search.data : ''),
	});
};
