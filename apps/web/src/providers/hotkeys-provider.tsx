'use client';

import { shouldIgnoreHotkey } from '@usecalendar/react';
import type { HotkeysOptions } from '@usehotkeys/core';
import { HotkeysProvider as BaseHotkeysProvider } from '@usehotkeys/react';
import type { ReactNode } from 'react';
import { KEYMAP } from '@/features/shortcuts/shortcuts';

// Module-level so the engine is created once. Keys are ignored as the calendar ignores them: while typing in a field
// (⌘/Ctrl combos still fire) and when a focused widget already handled them, such as the grid's arrows.
const OPTIONS: HotkeysOptions = { defaults: { ignoreInputs: shouldIgnoreHotkey }, keymap: KEYMAP };

/** One shortcut engine for the app, loaded with the registry's keymap. */
export function HotkeysProvider({ children }: { children: ReactNode }) {
	return <BaseHotkeysProvider options={OPTIONS}>{children}</BaseHotkeysProvider>;
}
