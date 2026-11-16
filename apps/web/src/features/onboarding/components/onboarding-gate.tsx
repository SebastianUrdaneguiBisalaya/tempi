'use client';

import type { ReactNode } from 'react';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useApi } from '@/providers/api-provider';
import { Onboarding } from './onboarding';

/** Shows the onboarding until it's completed, then the app. Outside the desktop app there is no storage, so nothing to set up. */
export function OnboardingGate({ children }: { children: ReactNode }) {
	const hasStorage = useApi() !== null;
	const { data: settings, isError } = useSettings();

	if (settings?.onboardingCompleted === false) return <Onboarding settings={settings} />;
	// Settings are local and load almost instantly; rendering nothing avoids flashing the app before the onboarding.
	if (hasStorage && settings === undefined && !isError) return null;
	return children;
}
