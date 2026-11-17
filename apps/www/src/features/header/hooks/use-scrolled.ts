'use client';

import { useSyncExternalStore } from 'react';

const THRESHOLD = 16;

function subscribe(onChange: () => void) {
	window.addEventListener('scroll', onChange, { passive: true });
	return () => window.removeEventListener('scroll', onChange);
}

/** Whether the page has scrolled past the top, so the header can switch from transparent to solid. */
export function useScrolled() {
	return useSyncExternalStore(
		subscribe,
		() => window.scrollY > THRESHOLD,
		() => false
	);
}
