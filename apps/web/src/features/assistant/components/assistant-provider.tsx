'use client';

import { MAX_SPEECH_LENGTH, resolveLanguage, type TextProvider } from '@tempi/core';
import { createContext, type ReactNode, use, useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { useApi } from '@/providers/api-provider';
import { type AssistantActions, type AssistantState, type AssistantStore, type AssistantTab, type AssistantTurn, createAssistantStore } from '../assistant-store';
import { createDictationStore, type DictationActions, type DictationAudio, type DictationState, type DictationStore } from '../dictation-store';
import { useSpeak } from '../hooks/use-speak';
import { useTranscribe } from '../hooks/use-transcribe';
import { createSpeechPlayer, type SpeechPlayer } from '../speech-player';
import { createVoiceStore, type VoiceActions, type VoiceState, type VoiceStore } from '../voice-store';

type AssistantContextValue = {
	dictation: DictationStore;
	open: boolean;
	openTab: (tab: AssistantTab) => void;
	setOpen: (open: boolean) => void;
	store: AssistantStore;
	voice: { store: VoiceStore; recorder: DictationStore; player: SpeechPlayer };
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

/** Marks the control a tab focuses when it opens: the prompt in Chat, the orb in Voice. Only the shown tab renders one. */
export const ASSISTANT_FOCUS = { 'data-assistant-focus': '' } as const;

/** The shown tab's control, for the panel's initial focus. */
export const assistantFocusTarget = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-assistant-focus]');

const focusAssistantTarget = () => assistantFocusTarget()?.focus();

/** Owns the assistant for the session: its conversation and whether the panel is open. ⌘J opens Chat and ⌘⇧J Voice. */
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
	// Each shortcut opens its tab, or closes the panel when that tab is already shown.
	const openTab = (tab: AssistantTab) => {
		if (open && store.getState().tab === tab) return setOpen(false);
		store.getState().setTab(tab);
		setOpen(true);
		// A panel that was already open keeps its focus; move it to the tab's control once that tab renders.
		requestAnimationFrame(focusAssistantTarget);
	};
	useShortcut('openAssistantChat', () => openTab('chat'));
	useShortcut('openAssistantVoice', () => openTab('voice'));

	// Each finished recording is transcribed here, above the panel, so it lands in the prompt even if the panel collapsed.
	const onAudio = useEffectEvent(({ audio, mimeType }: DictationAudio) => {
		// The app's language hints the transcription; ElevenLabs still recognizes another one if spoken.
		const language = resolveLanguage([i18n.language]);
		transcribe.mutate({ audio, language, mimeType }, { onSettled: dictation.getState().finishTranscribing, onSuccess: store.getState().appendDraft });
	});
	// Connects the recorder (an external store) to this tree; leaving the app view drops any recording in progress.
	useEffect(() => {
		const { cancel, setAudioHandler } = dictation.getState();
		setAudioHandler(audio => onAudio(audio));
		return () => {
			setAudioHandler(null);
			cancel();
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
		const turn = await store.getState().send(api, provider, text, { voice: true });
		return turn === null || turn.status !== 'done' ? null : spokenReply(turn);
	});
	const speakStep = useEffectEvent((text: string) => speak.mutateAsync({ language: resolveLanguage([i18n.language]), text }).catch(() => null));
	const stopReplyStep = useEffectEvent(() => {
		if (api !== null) store.getState().stop(api);
	});
	const transcribeStep = useEffectEvent(({ audio, mimeType }: DictationAudio) => transcribe.mutateAsync({ audio, language: resolveLanguage([i18n.language]), mimeType }).catch(() => null));
	useEffect(() => {
		const { cancel, setSteps } = voice.store.getState();
		setSteps({
			reply: (provider, text) => replyStep(provider, text),
			speak: text => speakStep(text),
			stopReply: () => stopReplyStep(),
			transcribe: audio => transcribeStep(audio),
		});
		return () => {
			setSteps(null);
			cancel();
		};
	}, [voice]);

	return <AssistantContext value={{ dictation, open, openTab, setOpen, store, voice }}>{children}</AssistantContext>;
}

const useAssistantContext = (): AssistantContextValue => {
	const context = use(AssistantContext);
	if (context === null) throw new Error('useAssistant must be used inside AssistantProvider');
	return context;
};

/**
 * Reads what `select` picks from the conversation (and its actions). The component re-renders only when that changes,
 * so the prompt doesn't re-render with each streamed token. Select single values, never a new object.
 */
export const useAssistant = <T,>(select: (state: AssistantState & AssistantActions) => T): T => useStore(useAssistantContext().store, select);

/** Sending, stopping and starting over, which go through the API. Outside the desktop app there is none, so they do nothing. */
export const useAssistantRequests = () => {
	const { store, voice } = useAssistantContext();
	const api = useApi();
	return {
		send: (provider: TextProvider, text: string) => {
			if (api !== null) void store.getState().send(api, provider, text);
		},
		stop: () => {
			if (api !== null) store.getState().stop(api);
		},
		clear: () => {
			// Starting over also silences a spoken exchange in progress.
			voice.store.getState().cancel();
			if (api !== null) store.getState().clear(api);
		},
	};
};

/** Reads what `select` picks from the dictation recorder. Its meter changes many times a second: read it through `useDictationStore`. */
export const useDictation = <T,>(select: (state: DictationState & DictationActions) => T): T => useStore(useAssistantContext().dictation, select);

/** The dictation recorder itself, for what follows its meter outside React renders (the waveform). */
export const useDictationStore = (): DictationStore => useAssistantContext().dictation;

/** Reads what `select` picks from the spoken exchange: its phase, its error and a way to move it on. */
export const useVoice = <T,>(select: (state: VoiceState & VoiceActions) => T): T => useStore(useAssistantContext().voice.store, select);

/**
 * Live loudness sources for the orb: the microphone while listening, the speech while speaking. Read outside React
 * renders, so the orb animates without re-rendering.
 */
export const useVoiceLevels = () => {
	const { voice } = useAssistantContext();
	return {
		listening: { get: () => voice.recorder.getState().meter.levels.at(-1) ?? 0, subscribe: voice.recorder.subscribe },
		speaking: { get: voice.player.getLevel, subscribe: voice.player.subscribeLevel },
	};
};

/** Whether the panel is open, and ways to change it: `openTab` opens a tab (or closes the panel already on it). */
export const useAssistantPanel = () => {
	const { open, openTab, setOpen } = useAssistantContext();
	return { open, openTab, setOpen, toggle: () => setOpen(!open) };
};
