'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiKeyInput, AiProvider, AiSettings, AiSettingsPatch } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** The AI choices and which providers have a key. `data` stays undefined while loading and outside the desktop app. */
export const useAiSettings = () => {
	const api = useApi();
	return useQuery({
		enabled: api !== null,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.ai.getSettings());
		},
		queryKey: queryKeys.ai.settings,
	});
};

/** Every AI mutation answers with the new settings; keep them, and drop voices that may belong to another key. */
const useOnAiSettings = () => {
	const queryClient = useQueryClient();
	return (settings: AiSettings) => {
		queryClient.setQueryData(queryKeys.ai.settings, settings);
		void queryClient.invalidateQueries({ queryKey: queryKeys.ai.voices });
	};
};

export const useSaveAiSettings = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (patch: AiSettingsPatch) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.ai.saveSettings(patch));
		},
		meta: { successMessage: 'toasts.aiSettingsSaved' },
		onSuccess: settings => queryClient.setQueryData(queryKeys.ai.settings, settings),
	});
};

/** Tests a key and saves it only if the provider accepts it. A rejected key shows on the key field. */
export const useSaveAiKey = () => {
	const api = useApi();
	const onSettings = useOnAiSettings();
	return useMutation({
		mutationFn: async (input: AiKeyInput) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.ai.saveKey(input));
		},
		meta: { handlesFieldErrors: true, successMessage: 'toasts.aiKeySaved' },
		onSuccess: onSettings,
	});
};

export const useRemoveAiKey = () => {
	const api = useApi();
	const onSettings = useOnAiSettings();
	return useMutation({
		mutationFn: async (provider: AiProvider) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.ai.removeKey(provider));
		},
		meta: { successMessage: 'toasts.aiKeyRemoved' },
		onSuccess: onSettings,
	});
};

/** Tests the saved key again. */
export const useTestAiKey = () => {
	const api = useApi();
	return useMutation({
		mutationFn: async (provider: AiProvider) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.ai.testKey(provider));
		},
		meta: { successMessage: 'toasts.aiKeyWorks' },
	});
};

/** The ElevenLabs voices, once a key is saved. */
export const useAiVoices = (enabled: boolean) => {
	const api = useApi();
	return useQuery({
		enabled: api !== null && enabled,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.ai.listVoices());
		},
		queryKey: queryKeys.ai.voices,
	});
};
