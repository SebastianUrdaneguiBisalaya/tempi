import type { KeyLayout, Keymap } from '@usehotkeys/core';

/**
 * Where a shortcut is live. `global` is the library's base scope (always on); `grid` is on while the calendar is
 * shown; `dialog` is pushed by every open dialog without inheriting, so nothing behind a dialog fires.
 */
export const HOTKEY_SCOPES = { dialog: 'dialog', global: 'global', grid: 'grid' } as const;
type HotkeyScope = (typeof HOTKEY_SCOPES)[keyof typeof HOTKEY_SCOPES];

/** Display order of the groups in the shortcuts lists. */
export const SHORTCUT_GROUPS = ['navigation', 'views', 'events', 'general'] as const;
type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

type ShortcutDefinition = { group: ShortcutGroup; keys: string | readonly string[]; layout?: KeyLayout; scope: HotkeyScope };

/**
 * The registry: every shortcut in the app, its keys and where it is live. Components bind actions by name
 * (`useShortcut`) and the shortcuts lists read this, so nothing else writes keys. Labels are translated from
 * `shortcuts.actions.<action>`.
 */
export const SHORTCUTS = {
	goToToday: { group: 'navigation', keys: 't', scope: HOTKEY_SCOPES.grid },
	next: { group: 'navigation', keys: ['j', 'arrowright'], scope: HOTKEY_SCOPES.grid },
	previous: { group: 'navigation', keys: ['k', 'arrowleft'], scope: HOTKEY_SCOPES.grid },
	goToDate: { group: 'navigation', keys: '.', scope: HOTKEY_SCOPES.grid },
	dayView: { group: 'views', keys: 'd', scope: HOTKEY_SCOPES.grid },
	weekView: { group: 'views', keys: 'w', scope: HOTKEY_SCOPES.grid },
	monthView: { group: 'views', keys: 'm', scope: HOTKEY_SCOPES.grid },
	newEvent: { group: 'events', keys: 'c', scope: HOTKEY_SCOPES.grid },
	deleteEvent: { group: 'events', keys: ['backspace', 'delete'], scope: HOTKEY_SCOPES.grid },
	undo: { group: 'events', keys: 'mod+z', scope: HOTKEY_SCOPES.global },
	openCommandMenu: { group: 'general', keys: 'mod+k', scope: HOTKEY_SCOPES.global },
	showShortcuts: { group: 'general', keys: '?', scope: HOTKEY_SCOPES.global },
	openSettings: { group: 'general', keys: 'mod+,', scope: HOTKEY_SCOPES.global },
	// The physical key under Esc (`Backquote`), not the character: on layouts such as Spanish, "`" is a dead key
	// that never reaches the page as a plain keypress.
	toggleSidebar: { group: 'general', keys: '`', layout: 'physical', scope: HOTKEY_SCOPES.global },
	togglePanel: { group: 'general', keys: 'p', scope: HOTKEY_SCOPES.grid },
	toggleAssistant: { group: 'general', keys: 'mod+j', scope: HOTKEY_SCOPES.global },
	close: { group: 'general', keys: 'escape', scope: HOTKEY_SCOPES.grid },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutAction = keyof typeof SHORTCUTS;

export const isShortcutAction = (action: string): action is ShortcutAction => Object.hasOwn(SHORTCUTS, action);

/** The registry as the engine's keymap, so bindings and `useShortcuts` share the same keys. */
export const KEYMAP: Keymap = Object.fromEntries(Object.entries(SHORTCUTS).map(([action, { group, keys }]) => [action, { group, keys }]));

const TEXT_INPUT_TYPES = new Set(['', 'date', 'datetime-local', 'email', 'month', 'number', 'password', 'search', 'tel', 'text', 'time', 'url', 'week']);

const isTyping = (target: EventTarget | null): boolean => {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
	return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type.toLowerCase());
};

/**
 * The default `ignoreInputs`: like the library's `auto` (plain keys don't fire while typing, ⌘/Ctrl combos do), and
 * also skips keys a focused widget already handled, such as the arrows that move focus inside the grid.
 */
export const ignoreTypingOrHandled = (event: KeyboardEvent): boolean => event.defaultPrevented || (!(event.ctrlKey || event.metaKey) && isTyping(event.target));
