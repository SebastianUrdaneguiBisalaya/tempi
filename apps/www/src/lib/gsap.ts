'use client';

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { RefObject } from 'react';

// Registered once here so every section imports GSAP from this module and never repeats the setup.
gsap.registerPlugin(useGSAP, ScrollTrigger);

// Web fonts swap in after the triggers measure the page, shifting every section; measure again once they're in.
if (typeof document !== 'undefined') {
	document.fonts.ready.then(() => ScrollTrigger.refresh());
}

const MOTION_ALLOWED = '(prefers-reduced-motion: no-preference)';

/**
 * Runs `animate` scoped to `scope`, only when the visitor allows motion. Content must be visible without it: animate with
 * `gsap.from`, so with reduced motion (or before hydration) the page shows its final state. `animate` may return a cleanup.
 * When `dependencies` change, everything it started is reverted and it runs again.
 */
export function useMotion(scope: RefObject<HTMLElement | null>, animate: () => void | (() => void), dependencies: readonly unknown[] = []) {
	useGSAP(
		() => {
			const media = gsap.matchMedia();
			media.add(MOTION_ALLOWED, animate);
			return () => media.revert();
		},
		{ scope, dependencies: [...dependencies], revertOnUpdate: true }
	);
}

export { gsap, ScrollTrigger };
