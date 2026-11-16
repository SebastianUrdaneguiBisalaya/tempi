'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DomainError, GoogleSyncStatus } from '@tempi/core';
import { useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** A sync that ended badly, as the error the QueryProvider reports. */
const syncError = (status: GoogleSyncStatus): DomainError | null =>
	status.error === null ? null : { code: 'internal', issues: [{ detail: `Google sync ended as ${status.state}`, key: status.error }] };

/** Where Google sync stands; kept current by `useGoogleSyncUpdates`. */
export const useGoogleSyncStatus = () => {
	const api = useApi();
	return useQuery({
		enabled: api !== null,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.google.syncStatus());
		},
		queryKey: queryKeys.google.syncStatus,
	});
};

/** The connected account's calendars to pick from. */
export const useGoogleCalendars = (enabled: boolean) => {
	const api = useApi();
	return useQuery({
		enabled: api !== null && enabled,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.google.calendars());
		},
		queryKey: queryKeys.google.calendars,
	});
};

/** Identifies a running Sync now, whose outcome its own toast reports. */
export const SYNC_NOW_KEY = ['google', 'syncNow'] as const;

/** Syncs now. A sync that fails reports why, like any failed mutation. */
export const useSyncNow = () => {
	const { t } = useTranslation();
	const api = useApi();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			const status = unwrap(await api.google.sync());
			const error = syncError(status);
			if (error !== null) throw error;
			return status;
		},
		meta: { successToast: () => t('toasts.googleSynced') },
		mutationKey: SYNC_NOW_KEY,
	});
};

/** Chooses which Google calendars sync; unselected ones leave the sidebar at once, new ones arrive with the sync it starts. */
export const useSelectGoogleCalendars = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (googleIds: string[]) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.google.selectCalendars({ googleIds }));
		},
		meta: { successMessage: 'toasts.googleCalendarsSaved' },
		onSuccess: choices => {
			queryClient.setQueryData(queryKeys.google.calendars, choices);
			void queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
			void queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
		},
	});
};

/**
 * Follows the sync statuses the main process pushes. Each finished sync may have changed calendars and events, so
 * their views refresh; `onStatus` sees every status.
 */
export const useGoogleSyncUpdates = (onStatus?: (status: GoogleSyncStatus) => void) => {
	const api = useApi();
	const queryClient = useQueryClient();

	const receive = useEffectEvent((status: GoogleSyncStatus) => {
		queryClient.setQueryData(queryKeys.google.syncStatus, status);
		onStatus?.(status);
		if (status.state === 'syncing') return;
		void queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
		void queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
		void queryClient.invalidateQueries({ queryKey: queryKeys.google.calendars });
	});

	useEffect(() => api?.google.onSyncStatus(receive), [api]);
};
