'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { googleConnectResultSchema } from '@tempi/core';
import { useTranslation } from 'react-i18next';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** The connected Google account, or null. `data` stays undefined while loading and outside the desktop app. */
export const useGoogleAccount = () => {
	const api = useApi();
	return useQuery({
		enabled: api !== null,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.google.account());
		},
		queryKey: queryKeys.google.account,
	});
};

/** Signs in with Google in the system browser; declining there shows nothing. */
export const useConnectGoogle = () => {
	const { t } = useTranslation();
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.google.connect());
		},
		meta: {
			successToast: data => {
				const result = googleConnectResultSchema.safeParse(data);
				return result.success && result.data.status === 'connected' ? t('toasts.googleConnected') : null;
			},
		},
		// Refetched on failure too: `google.alreadyConnected` means another window connected meanwhile.
		onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.google.account }),
	});
};

/** Revokes and forgets the connected Google account. */
export const useDisconnectGoogle = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.google.disconnect());
		},
		meta: { successMessage: 'toasts.googleDisconnected' },
		onSuccess: () => {
			queryClient.setQueryData(queryKeys.google.account, null);
			// Google calendars and their events left Tempi with the account.
			void queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
			void queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
			void queryClient.invalidateQueries({ queryKey: ['google'] });
		},
	});
};
