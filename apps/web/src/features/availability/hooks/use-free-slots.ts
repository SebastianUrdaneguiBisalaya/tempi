'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { FreeSlotsQueryInput } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Free time for a valid search, or nothing while the search is incomplete (`null`). */
export const useFreeSlots = (query: FreeSlotsQueryInput | null) => {
	const api = useApi();
	return useQuery({
		enabled: api !== null && query !== null,
		placeholderData: keepPreviousData,
		queryFn: async () => {
			if (api === null || query === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.availability.freeSlots(query));
		},
		queryKey: query === null ? queryKeys.events.all : queryKeys.events.freeSlots(query),
		// Free time today shrinks as the clock moves, so a search opened again is read fresh instead of from the cache.
		staleTime: 0,
	});
};

/** Puts text on the clipboard: through the desktop app, whose renderer can't write it, or the browser's API outside it. */
export const useCopyText = () => {
	const api = useApi();
	return useMutation({
		meta: { successMessage: 'toasts.availabilityCopied' },
		mutationFn: async (text: string) => {
			if (api === null) return navigator.clipboard.writeText(text);
			unwrap(await api.app.copyText(text));
		},
	});
};
