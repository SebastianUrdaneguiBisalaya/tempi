import type { ShortcutAction } from '@/features/shortcuts/shortcuts';

/** Where a step's element lives. On narrow windows the sidebar and the panel are drawers the tour opens first. */
export type TourArea = 'main' | 'panel' | 'sidebar';

/** The `data-tour` values the tour targets. Components set them; nothing else selects by them. */
export const TOUR_TARGETS = {
	addCalendar: 'add-calendar',
	assistant: 'assistant',
	calendar: 'calendar',
	calendars: 'calendars',
	google: 'google',
	miniCalendar: 'mini-calendar',
	navigation: 'navigation',
	panel: 'panel',
	settings: 'settings',
	shortcutsHint: 'shortcuts-hint',
	views: 'views',
} as const;

export type TourTarget = (typeof TOUR_TARGETS)[keyof typeof TOUR_TARGETS];

export const TOUR_STEP_IDS = [
	'welcome',
	'calendar',
	'navigation',
	'views',
	'miniCalendar',
	'calendars',
	'addCalendar',
	'google',
	'panel',
	'assistant',
	'commandMenu',
	'shortcuts',
	'settings',
] as const;

export type TourStepId = (typeof TOUR_STEP_IDS)[number];

export type TourStep = {
	area: TourArea;
	/** Shortcuts listed under the description, with their keys read from `SHORTCUTS`. */
	shortcuts: readonly ShortcutAction[];
	/** No target: the popover shows centered over the dimmed app. */
	target?: TourTarget;
};

export const TOUR_STEPS = {
	welcome: { area: 'main', shortcuts: [] },
	calendar: { area: 'main', shortcuts: ['newEvent'], target: TOUR_TARGETS.calendar },
	navigation: { area: 'main', shortcuts: ['goToToday', 'previous', 'next', 'goToDate'], target: TOUR_TARGETS.navigation },
	views: { area: 'main', shortcuts: ['dayView', 'weekView', 'monthView'], target: TOUR_TARGETS.views },
	miniCalendar: { area: 'sidebar', shortcuts: [], target: TOUR_TARGETS.miniCalendar },
	calendars: { area: 'sidebar', shortcuts: [], target: TOUR_TARGETS.calendars },
	addCalendar: { area: 'sidebar', shortcuts: [], target: TOUR_TARGETS.addCalendar },
	// Without a Google account there is no Google section; the step then points to Settings › Integrations, centered.
	google: { area: 'sidebar', shortcuts: [], target: TOUR_TARGETS.google },
	panel: { area: 'panel', shortcuts: ['togglePanel'], target: TOUR_TARGETS.panel },
	assistant: { area: 'sidebar', shortcuts: ['toggleAssistant'], target: TOUR_TARGETS.assistant },
	commandMenu: { area: 'main', shortcuts: ['openCommandMenu'] },
	shortcuts: { area: 'panel', shortcuts: ['showShortcuts'], target: TOUR_TARGETS.shortcutsHint },
	settings: { area: 'main', shortcuts: ['openSettings'], target: TOUR_TARGETS.settings },
} as const satisfies Record<TourStepId, TourStep>;

export const tourSelector = (target: TourTarget) => `[data-tour="${target}"]`;
