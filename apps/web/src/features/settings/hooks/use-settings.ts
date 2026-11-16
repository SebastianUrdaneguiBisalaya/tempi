'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Settings, SettingsPatch } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Stored settings. `data` stays undefined while loading and outside the desktop app (no storage). */
export const useSettings = () => {
	const api = useApi();
	return useQuery({
		enabled: api !== null,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.settings.get());
		},
		queryKey: queryKeys.settings.all,
	});
};

/** Saves a settings patch; the saved settings replace the cached ones, so language and theme update without a reload. */
export const useSaveSettings = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (patch: SettingsPatch) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.settings.save(patch));
		},
		meta: { successMessage: 'toasts.settingsSaved' },
		onSuccess: settings => queryClient.setQueryData(queryKeys.settings.all, settings),
	});
};

/**
 * Collapses or expands the all-day lane. A view preference toggled in place: the change shows at once (optimistic)
 * and, unlike `useSaveSettings`, without a "Settings saved" toast. A failed save rolls it back and shows the error.
 */
export const useSetAllDayCollapsed = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (allDayCollapsed: boolean) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.settings.save({ allDayCollapsed }));
		},
		onError: (_error, _value, previous) => queryClient.setQueryData(queryKeys.settings.all, previous),
		onMutate: async allDayCollapsed => {
			await queryClient.cancelQueries({ queryKey: queryKeys.settings.all });
			const previous = queryClient.getQueryData<Settings>(queryKeys.settings.all);
			if (previous !== undefined) queryClient.setQueryData(queryKeys.settings.all, { ...previous, allDayCollapsed });
			return previous;
		},
		onSuccess: settings => queryClient.setQueryData(queryKeys.settings.all, settings),
	});
};
