'use client';

import type { UiSound } from '@tempi/core';
import { useSoundEngine } from '@usesounds/react';
import { useEffect } from 'react';
import { presetOf } from '../sounds';

const BUTTON_SELECTOR = 'button, [role="button"]';

/**
 * Plays `sound` on every button press in the app, its libraries' buttons included, so no button has to opt in.
 * It listens to `click`, which fires for the pointer and for Enter/Space alike and never for disabled buttons.
 */
export function ButtonSounds({ sound }: { sound: UiSound }) {
	const engine = useSoundEngine();

	useEffect(() => {
		const listener = (event: MouseEvent) => {
			// Programmatic clicks (`element.click()`) aren't the user pressing a button.
			if (!event.isTrusted || !(event.target instanceof Element)) return;
			const button = event.target.closest(BUTTON_SELECTOR);
			if (button === null || button.getAttribute('aria-disabled') === 'true') return;
			engine.play(presetOf(sound));
		};
		// Capture, so buttons that stop the click's propagation still sound.
		document.addEventListener('click', listener, { capture: true });
		return () => document.removeEventListener('click', listener, { capture: true });
	}, [engine, sound]);

	return null;
}
