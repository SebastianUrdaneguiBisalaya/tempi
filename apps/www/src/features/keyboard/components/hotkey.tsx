'use client';

import { useSyncExternalStore } from 'react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { formatHotkey } from '@/lib/hotkeys';

// The platform never changes during a visit.
const subscribe = () => () => {
	// Nothing to unsubscribe from.
};

/** Keys written for the visitor's platform; empty until hydrated, since the server can't know whether it's a Mac. */
export function Hotkey({ keys }: { keys: readonly string[] }) {
	const userAgent = useSyncExternalStore(
		subscribe,
		() => navigator.userAgent,
		() => null
	);
	if (userAgent === null) return null;
	return (
		<KbdGroup>
			{keys.map(key => (
				<Kbd key={key}>{formatHotkey(key, userAgent)}</Kbd>
			))}
		</KbdGroup>
	);
}
