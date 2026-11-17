import { detectPlatform } from './platform';

/**
 * Mirrors the keys in apps/web/src/features/shortcuts/shortcuts.ts for the shortcuts the landing page shows.
 * Update both when a binding changes.
 */
export const SHOWN_SHORTCUTS = {
	goToToday: ['t'],
	next: ['j', 'arrowright'],
	previous: ['k', 'arrowleft'],
	goToDate: ['.'],
	dayView: ['d'],
	weekView: ['w'],
	monthView: ['m'],
	newEvent: ['c'],
	undo: ['mod+z'],
	openCommandMenu: ['mod+k'],
	openSettings: ['mod+,'],
	showShortcuts: ['?'],
	togglePanel: ['p'],
	toggleAssistant: ['mod+j'],
} as const;

export type ShownShortcut = keyof typeof SHOWN_SHORTCUTS;

const NAMED_KEYS: Record<string, string> = { arrowright: '→', arrowleft: '←', arrowup: '↑', arrowdown: '↓', escape: 'Esc' };

/** A key combination as the visitor's platform writes it: ⌘K on macOS, Ctrl+K elsewhere. */
export function formatHotkey(keys: string, userAgent: string): string {
	const mac = detectPlatform(userAgent) === 'macos';
	const parts = keys.split('+').map(part => {
		if (part === 'mod') return mac ? '⌘' : 'Ctrl';
		return NAMED_KEYS[part] ?? part.toUpperCase();
	});
	return parts.join(mac ? '' : '+');
}
