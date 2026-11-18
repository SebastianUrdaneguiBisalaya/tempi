'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/**
 * Remembers that the guided tour was finished or dismissed, so it doesn't start again. A side effect of closing the
 * tour, not a setting the user changed, so it saves without a "Settings saved" toast; a failure still shows the error.
 */
export const useCompleteTour = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.settings.save({ tourCompleted: true }));
		},
		onSuccess: settings => queryClient.setQueryData(queryKeys.settings.all, settings),
	});
};
