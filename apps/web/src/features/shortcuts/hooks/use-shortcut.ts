'use client';

import type { HotkeyHandler } from '@usehotkeys/core';
import { type UseHotkeyActionOptions, useHotkeyAction, useHotkeyScope } from '@usehotkeys/react';
import { HOTKEY_SCOPES, SHORTCUTS, type ShortcutAction } from '../shortcuts';

/** Binds a registry action while the component is mounted, in the scope and layout the registry gives it. */
export const useShortcut = (action: ShortcutAction, handler: HotkeyHandler, options?: UseHotkeyActionOptions): void => {
	const definition: { layout?: 'logical' | 'physical'; scope: string } = SHORTCUTS[action];
	useHotkeyAction(action, handler, { layout: definition.layout, scope: definition.scope, ...options });
};

/** Pauses every shortcut behind a dialog while it is open; the dialog handles its own keys (Esc closes it). */
export const useDialogShortcutScope = (open: boolean): void => useHotkeyScope(HOTKEY_SCOPES.dialog, { enabled: open, inherit: false });

/** Turns on the shortcuts that act on the calendar while it is shown. */
export const useGridShortcutScope = (): void => useHotkeyScope(HOTKEY_SCOPES.grid);
