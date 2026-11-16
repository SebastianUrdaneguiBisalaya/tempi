'use client';

import { type ReactNode, useSyncExternalStore } from 'react';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useApi } from '@/providers/api-provider';
import { Onboarding } from './onboarding';

// Nothing changes after hydration, so there is nothing to subscribe to.
const subscribe = () => () => {
	// Nothing to unsubscribe from.
};

/** Shows the onboarding until it's completed, then the app. Outside the desktop app there is no storage, so nothing to set up. */
export function OnboardingGate({ children }: { children: ReactNode }) {
	// The static export is prerendered without `window.desktop`, so the prerendered HTML can't know whether onboarding is due;
	// rendering the app there flashed it on every reload before the onboarding replaced it.
	const hydrated = useSyncExternalStore(
		subscribe,
		() => true,
		() => false
	);
	const hasStorage = useApi() !== null;
	const { data: settings, isError } = useSettings();

	if (!hydrated) return null;
	if (settings?.onboardingCompleted === false) return <Onboarding settings={settings} />;
	// Settings are local and load almost instantly; rendering nothing avoids flashing the app before the onboarding.
	if (hasStorage && settings === undefined && !isError) return null;
	return children;
}
