'use client';

import { MAX_SPEECH_LENGTH, resolveLanguage, type TextProvider } from '@tempi/core';
import { createContext, type ReactNode, use, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { useApi } from '@/providers/api-provider';
import { type AssistantState, type AssistantStore, type AssistantTab, type AssistantTurn, createAssistantStore, type ProposalStatus } from '../assistant-store';
import { createDictationStore, type DictationAudio, type DictationStore } from '../dictation-store';
import { useSpeak } from '../hooks/use-speak';
import { useTranscribe } from '../hooks/use-transcribe';
import { createSpeechPlayer, type SpeechPlayer } from '../speech-player';
import { createVoiceStore, type VoiceStore } from '../voice-store';

type AssistantContextValue = {
	dictation: DictationStore;
	open: boolean;
	setOpen: (open: boolean) => void;
	store: AssistantStore;
	voice: { store: VoiceStore; recorder: DictationStore; player: SpeechPlayer };
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

/** Owns the assistant for the session: its conversation and whether the panel is open. ⌘J toggles it. */
export function AssistantProvider({ children }: { children: ReactNode }) {
	const { i18n, t } = useTranslation();
	const [store] = useState(createAssistantStore);
	const [dictation] = useState(createDictationStore);
	// The Voice tab records with its own recorder, so a dictation in the Chat tab never ends up spoken to, and back.
	const [voice] = useState(() => {
		const recorder = createDictationStore();
		const player = createSpeechPlayer();
		return { player, recorder, store: createVoiceStore(recorder, player) };
	});
	const [open, setOpen] = useState(false);
	const api = useApi();
	const transcribe = useTranscribe();
	const speak = useSpeak();
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

	// What a spoken reply says: its text or, if the model only proposed changes, what it proposed.
	const spokenReply = (turn: AssistantTurn): string => {
		const text = turn.text.trim();
		if (text !== '') return text.slice(0, MAX_SPEECH_LENGTH);
		return turn.proposals
			.map(({ proposal }) => t(`assistant.voice.proposed.${proposal.kind}`, { title: proposal.kind === 'create' ? proposal.input.title : proposal.event.title }))
			.join(' ')
			.slice(0, MAX_SPEECH_LENGTH);
	};

	// A spoken exchange runs here, above the panel, so collapsing it doesn't cut a reply short.
	const replyStep = useEffectEvent(async (provider: TextProvider, text: string) => {
		if (api === null) return null;
		const turn = await store.send(api, provider, text, { voice: true });
		return turn === null || turn.status !== 'done' ? null : spokenReply(turn);
	});
	const speakStep = useEffectEvent((text: string) => speak.mutateAsync({ language: resolveLanguage([i18n.language]), text }).catch(() => null));
	const stopReplyStep = useEffectEvent(() => {
		if (api !== null) store.stop(api);
	});
	const transcribeStep = useEffectEvent(({ audio, mimeType }: DictationAudio) => transcribe.mutateAsync({ audio, language: resolveLanguage([i18n.language]), mimeType }).catch(() => null));
	useEffect(() => {
		voice.store.setSteps({
			reply: (provider, text) => replyStep(provider, text),
			speak: text => speakStep(text),
			stopReply: () => stopReplyStep(),
			transcribe: audio => transcribeStep(audio),
		});
		return () => {
			voice.store.setSteps(null);
			voice.store.cancel();
		};
	}, [voice]);

	return <AssistantContext value={{ dictation, open, setOpen, store, voice }}>{children}</AssistantContext>;
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

/** The spoken exchange: its phase and a way to move it on. */
export const useVoice = () => {
	const { voice } = useAssistantContext();
	const state = useSyncExternalStore(voice.store.subscribe, voice.store.getState, voice.store.getState);
	return { ...state, tap: voice.store.tap };
};

/**
 * Live loudness sources for the orb: the microphone while listening, the speech while speaking. Read outside React
 * renders, so the orb animates without re-rendering.
 */
export const useVoiceLevels = () => {
	const { voice } = useAssistantContext();
	return {
		listening: { get: () => voice.recorder.getMeter().levels.at(-1) ?? 0, subscribe: voice.recorder.subscribeMeter },
		speaking: { get: voice.player.getLevel, subscribe: voice.player.subscribeLevel },
	};
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
	setVoiceProvider: (provider: TextProvider) => void;
	setTab: (tab: AssistantTab) => void;
	setProposalStatus: (turnId: string, proposalId: string, status: ProposalStatus) => void;
};

/** The conversation and what can be done with it. Outside the desktop app there is no API, so sending does nothing. */
export const useAssistant = (): AssistantState & AssistantActions => {
	const { store, voice } = useAssistantContext();
	const api = useApi();
	const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
	return {
		...state,
		clear: () => {
			// Starting over also silences a spoken exchange in progress.
			voice.store.cancel();
			if (api !== null) store.clear(api);
		},
		send: (provider, text) => {
			if (api !== null) void store.send(api, provider, text);
		},
		setDraft: store.setDraft,
		setProposalStatus: store.setProposalStatus,
		setProvider: store.setProvider,
		setTab: store.setTab,
		setVoiceProvider: store.setVoiceProvider,
		stop: () => (api === null ? undefined : store.stop(api)),
	};
};
