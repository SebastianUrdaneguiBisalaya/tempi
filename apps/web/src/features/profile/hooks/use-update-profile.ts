'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProfileUpdateInput } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Saves the profile edited in settings (with a new, removed or kept avatar); the saved profile replaces the cached one. */
export const useUpdateProfile = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: ProfileUpdateInput) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.profile.update(input));
		},
		meta: { handlesFieldErrors: true, successMessage: 'toasts.profileUpdated' },
		onSuccess: profile => queryClient.setQueryData(queryKeys.profile.all, profile),
	});
};
