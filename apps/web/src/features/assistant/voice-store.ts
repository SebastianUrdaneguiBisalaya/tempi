import type { ErrorKey, TextProvider } from '@tempi/core';
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

/**
 * One spoken exchange at a time: record, transcribe, reply, read the reply aloud. Tapping moves it on: start talking,
 * send, cancel while thinking, or stop the speech. Lives above the panel, like the conversation it adds to.
 */
export const createVoiceStore = (recorder: DictationStore, player: SpeechPlayer) => {
	let state: VoiceState = { error: null, phase: 'idle' };
	const listeners = new Set<() => void>();
	let steps: VoiceSteps | null = null;
	let provider: TextProvider | null = null;
	// Bumped by every cancel, so the answers of an exchange that was left behind are ignored.
	let exchange = 0;

	const set = (next: VoiceState) => {
		if (next.error === state.error && next.phase === state.phase) return;
		state = next;
		for (const listener of listeners) listener();
	};

	// The recorder says when listening really started (the microphone opened) or failed to.
	recorder.subscribe(() => {
		const { error, status } = recorder.getState();
		if (status === 'recording') set({ error: null, phase: 'listening' });
		else if (status === 'transcribing') set({ error: null, phase: 'thinking' });
		else if (state.phase === 'listening') set({ error, phase: 'idle' });
	});

	const run = async (audio: DictationAudio) => {
		const current = ++exchange;
		const isCurrent = () => current === exchange;
		const end = (error: ErrorKey | null = null) => {
			if (isCurrent()) set({ error, phase: 'idle' });
		};
		if (steps === null || provider === null) {
			recorder.finishTranscribing();
			return end();
		}
		const { reply, speak, transcribe } = steps;
		const text = await transcribe(audio);
		recorder.finishTranscribing();
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
	recorder.setAudioHandler(audio => void run(audio));

	const cancel = () => {
		exchange++;
		if (state.phase === 'thinking') steps?.stopReply();
		recorder.cancel();
		player.stop();
		set({ ...state, phase: 'idle' });
	};

	return {
		getState: () => state,
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		setSteps: (next: VoiceSteps | null) => {
			steps = next;
		},
		/** Moves the exchange on: talk (with `talkTo` answering), send what was said, cancel the reply, or stop speaking. */
		tap: (talkTo: TextProvider) => {
			if (state.phase === 'idle') {
				provider = talkTo;
				recorder.start();
			} else if (state.phase === 'listening') recorder.stop();
			else cancel();
		},
		/** Drops whatever is in progress, e.g. when the app view goes away. */
		cancel,
	};
};

export type VoiceStore = ReturnType<typeof createVoiceStore>;
