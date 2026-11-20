import { useSyncExternalStore } from 'react';

const subscribe = () => () => {
	// Nothing changes after hydration.
};

/**
 * False on the server and during hydration. Replicas wait for it before formatting dates with `Intl`, because Node and
 * browsers write them with different spaces and the markup wouldn't match.
 */
export function useHydrated() {
	return useSyncExternalStore(
		subscribe,
		() => true,
		() => false
	);
}
