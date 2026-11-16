'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppUpdateStatus } from '@tempi/core';
import { useEffect, useEffectEvent } from 'react';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Where the app's update stands; kept current by `useAppUpdates`. Undefined outside the desktop app. */
export const useAppUpdateStatus = () => {
	const api = useApi();
	return useQuery({
		enabled: api !== null,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.updates.status());
		},
		queryKey: queryKeys.updates.status,
	});
};

/** Checks for updates now. The outcome shows in the status, so there's no success toast. */
export const useCheckForUpdates = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.updates.check());
		},
		onSuccess: status => queryClient.setQueryData(queryKeys.updates.status, status),
	});
};

/** Quits and installs the downloaded update; Tempi reopens on the new version. */
export const useInstallUpdate = () => {
	const api = useApi();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.updates.install());
		},
	});
};

/** Follows the update statuses the main process pushes; `onStatus` sees every one. */
export const useAppUpdates = (onStatus?: (status: AppUpdateStatus) => void) => {
	const api = useApi();
	const queryClient = useQueryClient();

	const receive = useEffectEvent((status: AppUpdateStatus) => {
		queryClient.setQueryData(queryKeys.updates.status, status);
		onStatus?.(status);
	});

	useEffect(() => api?.updates.onStatus(receive), [api]);
};
