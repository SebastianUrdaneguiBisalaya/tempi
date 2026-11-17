/** How often the playback level is taken for the orb. */
const SAMPLE_MS = 50;

/** Loudness of one analyser frame, scaled so normal speech moves the orb clearly. */
const levelOf = (samples: Uint8Array): number => {
	let sum = 0;
	for (const sample of samples) {
		const centered = (sample - 128) / 128;
		sum += centered * centered;
	}
	return Math.min(1, Math.sqrt(sum / samples.length) * 4);
};

/**
 * Plays spoken replies from memory through Web Audio, with no file or URL in between, and reports their loudness while
 * they play.
 */
export const createSpeechPlayer = () => {
	let level = 0;
	const listeners = new Set<() => void>();
	let current: { context: AudioContext; source: AudioBufferSourceNode; frame: number } | null = null;

	const setLevel = (next: number) => {
		level = next;
		for (const listener of listeners) listener();
	};

	const stop = () => {
		// Stopping fires `ended`, which releases everything and settles `play`.
		current?.source.stop();
	};

	/** Plays the audio and resolves once it ended or was stopped. Rejects only if the audio can't be decoded. */
	const play = async (audio: Uint8Array): Promise<void> => {
		stop();
		const context = new AudioContext();
		let buffer: AudioBuffer;
		try {
			// `decodeAudioData` detaches the buffer it gets, so it gets a copy.
			buffer = await context.decodeAudioData(audio.slice().buffer);
		} catch (error) {
			void context.close();
			throw error;
		}
		const source = context.createBufferSource();
		source.buffer = buffer;
		const analyser = context.createAnalyser();
		analyser.fftSize = 512;
		source.connect(analyser).connect(context.destination);
		const samples = new Uint8Array(analyser.fftSize);
		let lastSample = 0;
		const playing = { context, frame: 0, source };
		const tick = (now: number) => {
			if (current !== playing) return;
			if (now - lastSample >= SAMPLE_MS) {
				lastSample = now;
				analyser.getByteTimeDomainData(samples);
				setLevel(levelOf(samples));
			}
			playing.frame = requestAnimationFrame(tick);
		};

		return new Promise(resolve => {
			source.onended = () => {
				cancelAnimationFrame(playing.frame);
				void context.close();
				if (current === playing) {
					current = null;
					setLevel(0);
				}
				resolve();
			};
			current = playing;
			playing.frame = requestAnimationFrame(tick);
			source.start();
		});
	};

	return {
		getLevel: () => level,
		subscribeLevel: (listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		play,
		stop,
	};
};

export type SpeechPlayer = ReturnType<typeof createSpeechPlayer>;
