'use client';

import { XIcon } from 'lucide-react';
import { createContext, type ReactNode, use, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { type TourLayout, useGuidedTour } from '../hooks/use-guided-tour';
import { TourStepBody } from './tour-step-body';

type TourControls = {
	/** True while the tour is on screen: the shell keeps its drawers open and non-modal so the popover stays usable. */
	active: boolean;
	layout: { current: TourLayout | null };
	/** Replays the tour. It doesn't change `tourCompleted`. */
	startTour: () => void;
};

const TourContext = createContext<TourControls | null>(null);

/** Owns the guided tour: starts it after the onboarding and lets Settings › About and ⌘K replay it. */
export function TourProvider({ children }: { children: ReactNode }) {
	const layout = useRef<TourLayout | null>(null);
	const { active, startTour, view } = useGuidedTour(layout);

	return (
		<TourContext value={{ active, layout, startTour }}>
			{children}
			{view !== null && createPortal(<TourStepBody googleConnected={view.googleConnected} step={view.step} />, view.descriptionHost)}
			{view !== null && createPortal(<XIcon aria-hidden />, view.closeHost)}
		</TourContext>
	);
}

export const useTour = (): TourControls => {
	const controls = use(TourContext);
	if (controls === null) throw new Error('useTour must be used inside TourProvider');
	return controls;
};

/** Lets the tour show the sidebar or the panel before a step inside them, and close them afterwards. */
export const useTourLayout = (layout: TourLayout): void => {
	const { layout: ref } = useTour();
	// The handlers read the shell's current state, so they are replaced after every render.
	useEffect(() => {
		ref.current = layout;
	});
	useEffect(
		() => () => {
			ref.current = null;
		},
		[ref]
	);
};
