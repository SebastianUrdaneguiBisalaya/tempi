'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { TimeStatsQueryInput } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Where the time of a period went. Keeps the previous period's report while the next loads, so charts don't flash. */
export const useTimeStats = (query: TimeStatsQueryInput | null) => {
	const api = useApi();
	return useQuery({
		enabled: api !== null && query !== null,
		placeholderData: keepPreviousData,
		queryFn: async () => {
			if (api === null || query === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.stats.time(query));
		},
		queryKey: query === null ? queryKeys.events.all : queryKeys.events.stats(query),
		// Hiding a calendar or changing working hours changes the report too, so opening it again reads it fresh.
		staleTime: 0,
	});
};
