'use client';

import { type Driver, type DriveStep, driver, type PopoverDOM } from 'driver.js';
import { type RefObject, useEffect, useEffectEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useDialogShortcutScope } from '@/features/shortcuts/hooks/use-shortcut';
import { TOUR_STEP_IDS, TOUR_STEPS, type TourArea, type TourStep, type TourStepId, tourSelector } from '../tour-steps';
import { useCompleteTour } from './use-complete-tour';

/** What the shell does for the tour: show the area of the next step, and put everything back when it ends. */
export type TourLayout = {
	/** Shows the area (opening its drawer on narrow windows) and closes the others. True while that still animates. */
	reveal: (area: TourArea) => boolean;
	reset: () => void;
};

/** Where the step's body renders: the popover's description and close button, which driver.js owns. */
export type TourView = { closeHost: HTMLElement; descriptionHost: HTMLElement; googleConnected: boolean; step: TourStepId };

// driver.js sets each text with innerHTML only when it changes, so one placeholder keeps the same host for every step.
const BODY_PLACEHOLDER = '<div data-tour-body></div>';
// Long enough for a drawer or the collapsed sidebar to slide in before the step measures its element.
const REVEAL_DELAY_MS = 320;
// Lets dialogs that started the tour (settings, command menu) finish closing and give focus back first.
const START_DELAY_MS = 250;

// The app's popover (`PopoverContent`) and its title, description and footer, on driver.js's elements.
// The wrapper stays `display: block` (driver.js sets it inline), so spacing comes from margins.
const POPOVER_CLASS = 'tempi-tour w-72 max-w-[calc(100vw-2rem)] min-w-0 rounded-lg bg-popover p-2.5 font-sans text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden';
const TITLE_CLASSES = ['pe-8', 'font-heading', 'text-sm', 'font-medium', 'leading-normal'];
const DESCRIPTION_CLASSES = ['mt-1', 'text-xs', 'leading-relaxed', 'text-muted-foreground'];
const FOOTER_CLASSES = ['mt-4', 'gap-2'];
const PROGRESS_CLASSES = ['text-xs', 'text-muted-foreground', 'tabular-nums'];
const NAVIGATION_CLASSES = ['gap-2'];

const classesOf = (value: string) => value.split(' ').filter(name => name !== '');

const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The theme's `--radius` in pixels, so the highlight's corners match the app's. */
const themeRadius = () => {
	const root = getComputedStyle(document.documentElement);
	const rem = Number.parseFloat(root.fontSize);
	const radius = Number.parseFloat(root.getPropertyValue('--radius'));
	return Number.isNaN(radius) || Number.isNaN(rem) ? 0 : radius * rem;
};

/** driver.js builds its popover from plain elements; give them the classes of the app's popover and buttons. */
const stylePopover = (popover: PopoverDOM) => {
	popover.title.classList.add(...TITLE_CLASSES);
	popover.description.classList.add(...DESCRIPTION_CLASSES);
	popover.footer.classList.add(...FOOTER_CLASSES);
	popover.progress.classList.add(...PROGRESS_CLASSES);
	popover.footerButtons.classList.add(...NAVIGATION_CLASSES);
	// driver.js paints its buttons white with dark text; the app's outline and ghost buttons are transparent and inherit the text color.
	popover.previousButton.classList.add(...classesOf(buttonVariants({ variant: 'outline' })), 'bg-transparent', 'text-popover-foreground');
	popover.nextButton.classList.add(...classesOf(buttonVariants()));
	popover.closeButton.classList.add(...classesOf(buttonVariants({ size: 'icon-sm', variant: 'ghost' })), 'absolute', 'top-2', 'end-2', 'text-popover-foreground');
	// The × text gives way to the app's icon, rendered by React.
	if (popover.closeButton.dataset.tourIcon === undefined) {
		popover.closeButton.textContent = '';
		popover.closeButton.dataset.tourIcon = '';
	}
};

/**
 * The guided tour of the main screen (driver.js). It starts once, after the onboarding, while `tourCompleted` is
 * false, and finishing or dismissing it saves `tourCompleted`. A replay never changes it.
 */
export const useGuidedTour = (layout: RefObject<TourLayout | null>) => {
	const { t } = useTranslation();
	const { data: settings } = useSettings();
	const { data: calendars } = useCalendars();
	const completeTour = useCompleteTour();
	const tourRef = useRef<Driver | null>(null);
	const [active, setActive] = useState(false);
	const [view, setView] = useState<TourView | null>(null);
	// Each replay request bumps this; the effect below starts it once the dialog that asked has closed.
	const [replays, setReplays] = useState(0);

	// Keys pressed during the tour move it; the calendar's own shortcuts (arrows, T, C…) wait until it ends.
	useDialogShortcutScope(active);

	const run = useEffectEvent((persist: boolean) => {
		tourRef.current?.destroy();
		const googleConnected = calendars?.some(calendar => calendar.source === 'google') ?? false;
		const steps: DriveStep[] = TOUR_STEP_IDS.map(id => {
			const step: TourStep = TOUR_STEPS[id];
			const target = id === 'google' && !googleConnected ? undefined : step.target;
			return {
				element: target === undefined ? undefined : tourSelector(target),
				popover: {
					description: BODY_PLACEHOLDER,
					showButtons: id === 'welcome' ? ['next', 'close'] : ['next', 'previous', 'close'],
					title: escapeHtml(t(`tour.steps.${id}.title`)),
				},
			};
		});

		// Steps change only after the shell has shown their area, which on narrow windows means opening a drawer first.
		let moving = false;
		const go = (tour: Driver, delta: 1 | -1) => {
			if (moving) return;
			const index = (tour.getActiveIndex() ?? 0) + delta;
			const id = TOUR_STEP_IDS[index];
			if (id === undefined) {
				if (delta === 1) tour.destroy();
				return;
			}
			if (!(layout.current?.reveal(TOUR_STEPS[id].area) ?? false)) return tour.moveTo(index);
			moving = true;
			window.setTimeout(() => {
				moving = false;
				if (tour.isActive()) tour.moveTo(index);
			}, REVEAL_DELAY_MS);
		};

		const tour = driver({
			animate: !prefersReducedMotion(),
			closeBtnLabel: escapeHtml(t('tour.close')),
			doneBtnText: escapeHtml(t('tour.done')),
			nextBtnText: escapeHtml(t('tour.next')),
			// A stray click outside the step would end the tour and mark it as seen; only ×, Esc or Done close it.
			overlayClickBehavior: 'none',
			// A token, so the dimming follows the theme, even when it changes mid-tour.
			overlayColor: 'var(--tour-overlay)',
			overlayOpacity: 1,
			popoverClass: POPOVER_CLASS,
			popoverOffset: 8,
			prevBtnText: escapeHtml(t('tour.previous')),
			progressText: escapeHtml(t('tour.progress', { current: '{{current}}', total: '{{total}}' })),
			showProgress: true,
			stagePadding: 4,
			stageRadius: themeRadius(),
			steps,
			onDestroyed: () => {
				tourRef.current = null;
				layout.current?.reset();
				setActive(false);
				setView(null);
				if (persist) completeTour.mutate();
			},
			onNextClick: (_element, _step, { driver: current }) => go(current, 1),
			onPopoverRender: (popover, { index }) => {
				stylePopover(popover);
				const step = TOUR_STEP_IDS[index ?? 0] ?? 'welcome';
				const descriptionHost = popover.description.querySelector<HTMLElement>('[data-tour-body]');
				if (descriptionHost === null) return;
				// The body must be in place before driver.js measures the popover to position it.
				flushSync(() => setView({ closeHost: popover.closeButton, descriptionHost, googleConnected, step }));
			},
			onPrevClick: (_element, _step, { driver: current }) => go(current, -1),
		});
		tourRef.current = tour;
		setActive(true);
		layout.current?.reveal('main');
		tour.drive();
	});

	const due = settings?.onboardingCompleted === true && !settings.tourCompleted;
	useEffect(() => {
		if (!due) return;
		const timer = window.setTimeout(() => run(true), START_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [due]);

	// Leaving the screen ends the tour without counting it as seen.
	useEffect(
		() => () => {
			const tour = tourRef.current;
			if (tour === null) return;
			tour.setConfig({ ...tour.getConfig(), onDestroyed: undefined });
			tour.destroy();
		},
		[]
	);

	useEffect(() => {
		if (replays === 0) return;
		const timer = window.setTimeout(() => run(false), START_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [replays]);

	return { active, startTour: () => setReplays(count => count + 1), view };
};
