import type { ErrorKey, TextProvider } from '@tempi/core';
import { createStore } from 'zustand/vanilla';
import type { DictationAudio, DictationStore } from './dictation-store';
import type { SpeechPlayer } from './speech-player';

/** Where a spoken exchange stands; the orb shows each one. */
export type VoicePhase = 'idle' | 'listening' | 'speaking' | 'thinking';

export type VoiceState = {
	phase: VoicePhase;
	/** Why the last exchange stopped short (no microphone, unplayable audio); cleared by the next one. */
	error: ErrorKey | null;
};

/**
 * The calls one exchange makes, supplied by the app (they go through the API and its error toasts). Each answers null
 * when it failed, which ends the exchange.
 */
export type VoiceSteps = {
	transcribe: (audio: DictationAudio) => Promise<string | null>;
	/** Sends what the user said and answers with what to read aloud once the reply ended. */
	reply: (provider: TextProvider, text: string) => Promise<string | null>;
	speak: (text: string) => Promise<Uint8Array | null>;
	/** Stops a reply still streaming. */
	stopReply: () => void;
};

export type VoiceActions = {
	setSteps: (steps: VoiceSteps | null) => void;
	/** Moves the exchange on: talk (with `talkTo` answering), send what was said, cancel the reply, or stop speaking. */
	tap: (talkTo: TextProvider) => void;
	/** Drops whatever is in progress, e.g. when the app view goes away. */
	cancel: () => void;
};

/**
 * One spoken exchange at a time: record, transcribe, reply, read the reply aloud. Tapping moves it on: start talking,
 * send, cancel while thinking, or stop the speech. Lives above the panel, like the conversation it adds to.
 */
export const createVoiceStore = (recorder: DictationStore, player: SpeechPlayer) =>
	createStore<VoiceState & VoiceActions>()((set, get) => {
		let steps: VoiceSteps | null = null;
		let provider: TextProvider | null = null;
		// Bumped by every cancel, so the answers of an exchange that was left behind are ignored.
		let exchange = 0;

		// The recorder says when listening really started (the microphone opened) or failed to. Its meter is not our business.
		recorder.subscribe(({ error, status }, previous) => {
			if (status === previous.status && error === previous.error) return;
			if (status === 'recording') set({ error: null, phase: 'listening' });
			else if (status === 'transcribing') set({ error: null, phase: 'thinking' });
			else if (get().phase === 'listening') set({ error, phase: 'idle' });
		});

		const run = async (audio: DictationAudio) => {
			const current = ++exchange;
			const isCurrent = () => current === exchange;
			const end = (error: ErrorKey | null = null) => {
				if (isCurrent()) set({ error, phase: 'idle' });
			};
			const { finishTranscribing } = recorder.getState();
			if (steps === null || provider === null) {
				finishTranscribing();
				return end();
			}
			const { reply, speak, transcribe } = steps;
			const text = await transcribe(audio);
			finishTranscribing();
			if (text === null || !isCurrent()) return end();
			const spoken = await reply(provider, text);
			if (spoken === null || spoken === '' || !isCurrent()) return end();
			const speech = await speak(spoken);
			if (speech === null || !isCurrent()) return end();
			set({ error: null, phase: 'speaking' });
			try {
				await player.play(speech);
				end();
			} catch (error) {
				console.error('Could not play the spoken reply', error);
				end('ai.speechFailed');
			}
		};
		recorder.getState().setAudioHandler(audio => void run(audio));

		const cancel = () => {
			exchange++;
			if (get().phase === 'thinking') steps?.stopReply();
			recorder.getState().cancel();
			player.stop();
			set({ phase: 'idle' });
		};

		return {
			error: null,
			phase: 'idle',
			setSteps: next => {
				steps = next;
			},
			tap: talkTo => {
				const { phase } = get();
				if (phase === 'idle') {
					provider = talkTo;
					recorder.getState().start();
				} else if (phase === 'listening') recorder.getState().stop();
				else cancel();
			},
			cancel,
		};
	});

export type VoiceStore = ReturnType<typeof createVoiceStore>;
