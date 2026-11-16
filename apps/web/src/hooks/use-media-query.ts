import { useSyncExternalStore } from 'react';

/** Whether a CSS media query matches. The prerender has no window, so it renders as `serverValue`. */
export const useMediaQuery = (query: string, serverValue: boolean): boolean =>
	useSyncExternalStore(
		onChange => {
			const list = window.matchMedia(query);
			list.addEventListener('change', onChange);
			return () => list.removeEventListener('change', onChange);
		},
		() => window.matchMedia(query).matches,
		() => serverValue
	);
