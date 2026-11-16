'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OnboardingInput } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Saves the onboarding answers in one step; the saved profile and settings replace the cached ones, which leaves onboarding. */
export const useCompleteOnboarding = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: OnboardingInput) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.onboarding.complete(input));
		},
		meta: { handlesFieldErrors: true, successMessage: 'toasts.onboardingCompleted' },
		onSuccess: ({ profile, settings }) => {
			queryClient.setQueryData(queryKeys.profile.all, profile);
			queryClient.setQueryData(queryKeys.settings.all, settings);
		},
	});
};
