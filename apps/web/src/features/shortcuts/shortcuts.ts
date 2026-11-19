import { CALENDAR_FOCUS_KEYS, CALENDAR_KEYMAP, type CalendarHotkeys, GLOBAL_HOTKEY_ACTIONS } from '@usecalendar/core';
import type { KeyLayout, Keymap } from '@usehotkeys/core';

/**
 * Where a shortcut is live. `global` is the library's base scope (always on); `grid` is on while the calendar is
 * shown; `dialog` is pushed by every open dialog without inheriting, so nothing behind a dialog fires.
 */
export const HOTKEY_SCOPES = { dialog: 'dialog', global: 'global', grid: 'grid' } as const;
type HotkeyScope = (typeof HOTKEY_SCOPES)[keyof typeof HOTKEY_SCOPES];

/** Display order of the groups in the shortcuts lists. */
export const SHORTCUT_GROUPS = ['navigation', 'views', 'events', 'grid', 'focus', 'general'] as const;
type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

type ShortcutDefinition = { group: ShortcutGroup; keys: string | readonly string[]; layout?: KeyLayout; scope: HotkeyScope };

// The calendar's global actions keep `@usecalendar`'s keys, so both list the same ones; the rest are its grid keys.
const { close, dayView, deleteEvent, goToDate, goToToday, monthView, newEvent, next, previous, weekView, ...calendarGridKeys } = CALENDAR_KEYMAP;

/**
 * The calendar's own global shortcuts, turned off in `<Calendar hotkeys>`: the app binds them through `SHORTCUTS`
 * instead, in its scopes, so they pause behind dialogs. Its grid keys (Enter, Alt+arrows, Escape on a drag) stay on.
 */
export const CALENDAR_HOTKEYS: CalendarHotkeys = Object.fromEntries(GLOBAL_HOTKEY_ACTIONS.map(action => [action, null]));

/**
 * The registry: every shortcut the app binds, its keys and where it is live. Components bind actions by name
 * (`useShortcut`) and the shortcuts lists read this, so nothing else writes keys. Labels are translated from
 * `shortcuts.actions.<action>`.
 */
export const SHORTCUTS = {
	goToToday: { ...goToToday, scope: HOTKEY_SCOPES.grid },
	next: { ...next, scope: HOTKEY_SCOPES.grid },
	previous: { ...previous, scope: HOTKEY_SCOPES.grid },
	goToDate: { ...goToDate, scope: HOTKEY_SCOPES.grid },
	dayView: { ...dayView, scope: HOTKEY_SCOPES.grid },
	weekView: { ...weekView, scope: HOTKEY_SCOPES.grid },
	monthView: { ...monthView, scope: HOTKEY_SCOPES.grid },
	newEvent: { ...newEvent, scope: HOTKEY_SCOPES.grid },
	deleteEvent: { ...deleteEvent, scope: HOTKEY_SCOPES.grid },
	undo: { group: 'events', keys: 'mod+z', scope: HOTKEY_SCOPES.global },
	openCommandMenu: { group: 'general', keys: 'mod+k', scope: HOTKEY_SCOPES.global },
	showShortcuts: { group: 'general', keys: '?', scope: HOTKEY_SCOPES.global },
	openSettings: { group: 'general', keys: 'mod+,', scope: HOTKEY_SCOPES.global },
	// The physical key under Esc (`Backquote`), not the character: on layouts such as Spanish, "`" is a dead key
	// that never reaches the page as a plain keypress.
	toggleSidebar: { group: 'general', keys: '`', layout: 'physical', scope: HOTKEY_SCOPES.global },
	togglePanel: { group: 'general', keys: 'p', scope: HOTKEY_SCOPES.grid },
	toggleAssistant: { group: 'general', keys: 'mod+j', scope: HOTKEY_SCOPES.global },
	close: { ...close, scope: HOTKEY_SCOPES.grid },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutAction = keyof typeof SHORTCUTS;

/**
 * Every shortcut the lists show: the registry plus the keys the calendar's grids handle themselves (moving an
 * event, moving focus), which are listed but never bound here.
 */
export const LISTED_SHORTCUTS = { ...SHORTCUTS, ...calendarGridKeys, ...CALENDAR_FOCUS_KEYS } as const satisfies Record<string, Pick<ShortcutDefinition, 'group' | 'keys'>>;

export type ListedAction = keyof typeof LISTED_SHORTCUTS;

export const isListedAction = (action: string): action is ListedAction => Object.hasOwn(LISTED_SHORTCUTS, action);

/** An action's keys as a list, for `ShortcutKeys`. */
export const shortcutKeysOf = (action: ShortcutAction): readonly string[] => {
	const { keys } = SHORTCUTS[action];
	return typeof keys === 'string' ? [keys] : keys;
};

export const isShortcutAction = (action: string): action is ShortcutAction => Object.hasOwn(SHORTCUTS, action);

/** Every listed shortcut as the engine's keymap, so bindings and `useShortcuts` share the same keys. */
export const KEYMAP: Keymap = Object.fromEntries(Object.entries(LISTED_SHORTCUTS).map(([action, { group, keys }]) => [action, { group, keys }]));
