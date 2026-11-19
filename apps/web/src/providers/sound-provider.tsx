'use client';

import { DEFAULT_SETTINGS } from '@tempi/core';
import { SoundProvider as BaseSoundProvider } from '@usesounds/react';
import type { ReactNode } from 'react';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { ButtonSounds } from '@/features/sounds/components/button-sounds';

/**
 * UI sounds, following the stored settings. Muted until they load, and outside the desktop app (no settings), so a
 * press never plays a sound the user turned off.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
	const { data: settings } = useSettings();

	return (
		// Not declarative: `ButtonSounds` plays every button, so no element needs a `data-sound` attribute.
		<BaseSoundProvider declarative={false} enabled={settings?.soundsEnabled ?? false}>
			<ButtonSounds sound={settings?.sound ?? DEFAULT_SETTINGS.sound} />
			{children}
		</BaseSoundProvider>
	);
}
