'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/**
 * Events matching `query`, upcoming first. Idle while the query is blank. Keeps the previous results while the next
 * ones load, so the list doesn't flash as the user types. Under the events root key, so edits refresh it.
 */
export const useEventSearch = (query: string) => {
	const api = useApi();
	const text = query.trim();
	return useQuery({
		enabled: api !== null && text !== '',
		placeholderData: keepPreviousData,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.search(text));
		},
		queryKey: queryKeys.events.search(text),
	});
};
