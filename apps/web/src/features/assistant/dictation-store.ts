import { type DictationAudioType, dictationAudioType, type ErrorKey, MAX_DICTATION_SECONDS } from '@tempi/core';

export type DictationStatus = 'idle' | 'recording' | 'transcribing';

export type DictationState = {
	status: DictationStatus;
	/** Why recording couldn't start (no microphone, permission denied); cleared by the next attempt. */
	error: ErrorKey | null;
};

/** What the waveform draws: recent microphone levels (0–1, oldest first) and the time recorded so far. */
export type DictationMeter = { levels: number[]; elapsedMs: number };

export type DictationAudio = { audio: Uint8Array<ArrayBuffer>; mimeType: DictationAudioType };

/** How many bars the waveform shows, and how often a new level is taken. */
export const WAVEFORM_BARS = 32;
const SAMPLE_MS = 60;

const SILENT: DictationMeter = { elapsedMs: 0, levels: Array.from({ length: WAVEFORM_BARS }, () => 0) };

// Opus in WebM is what Chromium records everywhere; the others are fallbacks for builds without it.
const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

const recordingType = (): string | undefined => RECORDING_TYPES.find(type => MediaRecorder.isTypeSupported(type));

/** Loudness of one analyser frame, scaled so normal speech fills most of a bar. */
const levelOf = (samples: Uint8Array): number => {
	let sum = 0;
	for (const sample of samples) {
		const centered = (sample - 128) / 128;
		sum += centered * centered;
	}
	return Math.min(1, Math.sqrt(sum / samples.length) * 4);
};

const startError = (error: unknown): ErrorKey =>
	error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError') ? 'ai.microphoneDenied' : 'ai.transcriptionFailed';

/**
 * Records one dictation from the microphone, in memory only, and hands its audio to `onAudio` once it stops (by the
 * user, or after the maximum length). Lives above the panel, so collapsing it doesn't cut a recording.
 */
export const createDictationStore = () => {
	let state: DictationState = { error: null, status: 'idle' };
	let meter = SILENT;
	const listeners = new Set<() => void>();
	const meterListeners = new Set<() => void>();
	let onAudio: ((audio: DictationAudio) => void) | null = null;
	let session: { recorder: MediaRecorder; stream: MediaStream; context: AudioContext; frame: number; limit: ReturnType<typeof setTimeout>; discard: boolean } | null = null;

	const set = (next: DictationState) => {
		state = next;
		for (const listener of listeners) listener();
	};
	const setMeter = (next: DictationMeter) => {
		meter = next;
		for (const listener of meterListeners) listener();
	};

	/** Releases the microphone (the OS indicator goes off) and the audio graph. */
	const release = () => {
		if (session === null) return;
		cancelAnimationFrame(session.frame);
		clearTimeout(session.limit);
		for (const track of session.stream.getTracks()) track.stop();
		void session.context.close();
		session = null;
		setMeter(SILENT);
	};

	const stop = () => {
		if (session === null || session.recorder.state === 'inactive') return;
		session.recorder.stop();
	};

	const start = async () => {
		if (state.status !== 'idle') return;
		set({ error: null, status: 'recording' });
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
		} catch (error) {
			console.error('Could not open the microphone', error);
			set({ error: startError(error), status: 'idle' });
			return;
		}

		const type = recordingType();
		const recorder = new MediaRecorder(stream, type === undefined ? {} : { mimeType: type });
		const chunks: Blob[] = [];
		recorder.ondataavailable = event => {
			if (event.data.size > 0) chunks.push(event.data);
		};
		recorder.onstop = () => {
			const discard = session?.discard ?? true;
			const mimeType = dictationAudioType(recorder.mimeType || type || '');
			release();
			if (discard || mimeType === null || chunks.length === 0) {
				if (!discard && mimeType === null) console.error(`MediaRecorder produced an unsupported type: ${recorder.mimeType}`);
				set({ error: discard || mimeType !== null ? null : 'ai.transcriptionFailed', status: 'idle' });
				return;
			}
			set({ error: null, status: 'transcribing' });
			void new Blob(chunks, { type: mimeType }).arrayBuffer().then(buffer => onAudio?.({ audio: new Uint8Array(buffer), mimeType }));
		};

		// The waveform reads the microphone level through an analyser; nothing is recorded from it.
		const context = new AudioContext();
		const analyser = context.createAnalyser();
		analyser.fftSize = 512;
		context.createMediaStreamSource(stream).connect(analyser);
		const samples = new Uint8Array(analyser.fftSize);
		const startedAt = performance.now();
		let lastSample = 0;
		const tick = (now: number) => {
			if (session === null) return;
			if (now - lastSample >= SAMPLE_MS) {
				lastSample = now;
				analyser.getByteTimeDomainData(samples);
				setMeter({ elapsedMs: now - startedAt, levels: [...meter.levels.slice(1), levelOf(samples)] });
			}
			session.frame = requestAnimationFrame(tick);
		};

		session = { context, discard: false, frame: requestAnimationFrame(tick), limit: setTimeout(stop, MAX_DICTATION_SECONDS * 1000), recorder, stream };
		recorder.start();
	};

	return {
		getMeter: () => meter,
		getState: () => state,
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		subscribeMeter: (listener: () => void) => {
			meterListeners.add(listener);
			return () => {
				meterListeners.delete(listener);
			};
		},
		/** Receives each finished recording; the receiver calls `finishTranscribing` once it is done with it. */
		setAudioHandler: (handler: ((audio: DictationAudio) => void) | null) => {
			onAudio = handler;
		},
		start: () => void start(),
		stop,
		finishTranscribing: () => {
			if (state.status === 'transcribing') set({ ...state, status: 'idle' });
		},
		/** Stops without transcribing, e.g. when the app view goes away. */
		cancel: () => {
			if (session === null) return;
			session.discard = true;
			if (session.recorder.state === 'inactive') release();
			else session.recorder.stop();
		},
	};
};

export type DictationStore = ReturnType<typeof createDictationStore>;
