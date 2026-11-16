'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Every calendar, visible or not. `data` stays undefined while loading and outside the desktop app (no storage). */
export const useCalendars = () => {
	const api = useApi();
	return useQuery({
		enabled: api !== null,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.calendars.list());
		},
		queryKey: queryKeys.calendars.all,
	});
};
