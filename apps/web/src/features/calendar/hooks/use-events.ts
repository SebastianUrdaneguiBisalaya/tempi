'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DateRange } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Events overlapping `range` (UTC). Keeps the previous range's events while the next loads, so the grid doesn't flash. */
export const useEvents = (range: DateRange | null) => {
	const api = useApi();
	return useQuery({
		enabled: api !== null && range !== null,
		placeholderData: keepPreviousData,
		queryFn: async () => {
			if (api === null || range === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.list(range));
		},
		queryKey: range === null ? queryKeys.events.all : queryKeys.events.range(range),
	});
};
