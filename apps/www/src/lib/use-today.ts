'use client';

import { useSyncExternalStore } from 'react';

// The date only changes at midnight; reading it once per visit is enough.
const subscribe = () => () => {
	// Nothing to unsubscribe from.
};
const todayKey = () => new Date().toDateString();

/**
 * The visitor's today at midnight, or null on the server and before hydration: the server doesn't know the visitor's
 * day, and Node and browsers format `Intl` output with different spaces, so mockups render dates on the client only.
 */
export function useToday(): Date | null {
	const key = useSyncExternalStore(subscribe, todayKey, () => null);
	return key === null ? null : new Date(key);
}
