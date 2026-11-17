'use client';

import { useMutation } from '@tanstack/react-query';
import type { SpeechInput } from '@tempi/core';
import { STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Reads a reply aloud with ElevenLabs, answering with its audio. Failures show the usual error toast. */
export const useSpeak = () => {
	const api = useApi();
	return useMutation({
		mutationFn: async (input: SpeechInput) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.ai.speak(input)).audio;
		},
	});
};
