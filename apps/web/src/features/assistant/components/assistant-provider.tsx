'use client';

import { resolveLanguage, type TextProvider } from '@tempi/core';
import { createContext, type ReactNode, use, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { useApi } from '@/providers/api-provider';
import { type AssistantState, type AssistantStore, type AssistantTab, createAssistantStore, type ProposalStatus } from '../assistant-store';
import { createDictationStore, type DictationAudio, type DictationStore } from '../dictation-store';
import { useTranscribe } from '../hooks/use-transcribe';

type AssistantContextValue = { dictation: DictationStore; open: boolean; setOpen: (open: boolean) => void; store: AssistantStore };

const AssistantContext = createContext<AssistantContextValue | null>(null);

/** Owns the assistant for the session: its conversation and whether the panel is open. ⌘J toggles it. */
export function AssistantProvider({ children }: { children: ReactNode }) {
	const { i18n } = useTranslation();
	const [store] = useState(createAssistantStore);
	const [dictation] = useState(createDictationStore);
	const [open, setOpen] = useState(false);
	const transcribe = useTranscribe();
	useShortcut('toggleAssistant', () => setOpen(current => !current));

	// Each finished recording is transcribed here, above the panel, so it lands in the prompt even if the panel collapsed.
	const onAudio = useEffectEvent(({ audio, mimeType }: DictationAudio) => {
		// The app's language hints the transcription; ElevenLabs still recognizes another one if spoken.
		const language = resolveLanguage([i18n.language]);
		transcribe.mutate({ audio, language, mimeType }, { onSettled: dictation.finishTranscribing, onSuccess: store.appendDraft });
	});
	// Connects the recorder (an external store) to this tree; leaving the app view drops any recording in progress.
	useEffect(() => {
		dictation.setAudioHandler(audio => onAudio(audio));
		return () => {
			dictation.setAudioHandler(null);
			dictation.cancel();
		};
	}, [dictation]);

	return <AssistantContext value={{ dictation, open, setOpen, store }}>{children}</AssistantContext>;
}

/** The recorder's state and its live levels, read separately so only the waveform redraws with the microphone. */
export const useDictation = () => {
	const { dictation } = useAssistantContext();
	const state = useSyncExternalStore(dictation.subscribe, dictation.getState, dictation.getState);
	return { ...state, start: dictation.start, stop: dictation.stop };
};

export const useDictationMeter = () => {
	const { dictation } = useAssistantContext();
	return useSyncExternalStore(dictation.subscribeMeter, dictation.getMeter, dictation.getMeter);
};

const useAssistantContext = (): AssistantContextValue => {
	const context = use(AssistantContext);
	if (context === null) throw new Error('useAssistant must be used inside AssistantProvider');
	return context;
};

/** Whether the panel is open, and a way to change it. */
export const useAssistantPanel = () => {
	const { open, setOpen } = useAssistantContext();
	return { open, setOpen, toggle: () => setOpen(!open) };
};

export type AssistantActions = {
	send: (provider: TextProvider, text: string) => void;
	stop: () => void;
	clear: () => void;
	setDraft: (draft: string) => void;
	setProvider: (provider: TextProvider) => void;
	setTab: (tab: AssistantTab) => void;
	setProposalStatus: (turnId: string, proposalId: string, status: ProposalStatus) => void;
};

/** The conversation and what can be done with it. Outside the desktop app there is no API, so sending does nothing. */
export const useAssistant = (): AssistantState & AssistantActions => {
	const { store } = useAssistantContext();
	const api = useApi();
	const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
	return {
		...state,
		clear: () => (api === null ? undefined : store.clear(api)),
		send: (provider, text) => {
			if (api !== null) void store.send(api, provider, text);
		},
		setDraft: store.setDraft,
		setProposalStatus: store.setProposalStatus,
		setProvider: store.setProvider,
		setTab: store.setTab,
		stop: () => (api === null ? undefined : store.stop(api)),
	};
};
