import { useSyncExternalStore } from 'react';

/** Whether the window is on screen (not minimized or hidden behind another space). The prerender counts as visible. */
export const useDocumentVisible = (): boolean =>
	useSyncExternalStore(
		onChange => {
			document.addEventListener('visibilitychange', onChange);
			return () => document.removeEventListener('visibilitychange', onChange);
		},
		() => document.visibilityState === 'visible',
		() => true
	);
