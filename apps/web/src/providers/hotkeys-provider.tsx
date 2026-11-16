'use client';

import type { HotkeysOptions } from '@usehotkeys/core';
import { HotkeysProvider as BaseHotkeysProvider } from '@usehotkeys/react';
import type { ReactNode } from 'react';
import { ignoreTypingOrHandled, KEYMAP } from '@/features/shortcuts/shortcuts';

// Module-level so the engine is created once.
const OPTIONS: HotkeysOptions = { defaults: { ignoreInputs: ignoreTypingOrHandled }, keymap: KEYMAP };

/** One shortcut engine for the app, loaded with the registry's keymap. */
export function HotkeysProvider({ children }: { children: ReactNode }) {
	return <BaseHotkeysProvider options={OPTIONS}>{children}</BaseHotkeysProvider>;
}
