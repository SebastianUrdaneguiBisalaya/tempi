'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SettingsPatch } from '@tempi/core';
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
