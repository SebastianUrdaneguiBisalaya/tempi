'use client';

import { useMutation } from '@tanstack/react-query';
import type { TranscriptionInput } from '@tempi/core';
import { STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Transcribes a recorded dictation with ElevenLabs. Failures show the usual error toast. */
export const useTranscribe = () => {
	const api = useApi();
	return useMutation({
		mutationFn: async (input: TranscriptionInput) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.ai.transcribe(input)).text;
		},
	});
};
