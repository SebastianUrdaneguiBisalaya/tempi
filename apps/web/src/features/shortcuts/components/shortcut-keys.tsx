'use client';

import { formatHotkey } from '@usehotkeys/core';
import { useSyncExternalStore } from 'react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

// The platform never changes while the app runs.
const subscribeNever = () => () => {
	// Nothing to unsubscribe from.
};

/** The keys of a shortcut, written for the user's platform (⌘Z on macOS, Ctrl+Z elsewhere). */
export function ShortcutKeys({ keys }: { keys: readonly string[] }) {
	// The platform is only known in the browser: rendering nothing until hydrated keeps the prerender's markup equal.
	const hydrated = useSyncExternalStore(
		subscribeNever,
		() => true,
		() => false
	);
	if (!hydrated) return null;
	return (
		<KbdGroup>
			{keys.map(key => (
				<Kbd key={key}>{formatHotkey(key)}</Kbd>
			))}
		</KbdGroup>
	);
}
