'use client';

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { RefObject } from 'react';

// Registered once here so every section imports GSAP from this module and never repeats the setup.
gsap.registerPlugin(useGSAP, ScrollTrigger);

const MOTION_ALLOWED = '(prefers-reduced-motion: no-preference)';

/**
 * Runs `animate` scoped to `scope`, only when the visitor allows motion. Content must be visible without it: animate with
 * `gsap.from`, so with reduced motion (or before hydration) the page shows its final state.
 */
export function useMotion(scope: RefObject<HTMLElement | null>, animate: () => void) {
	useGSAP(
		() => {
			const media = gsap.matchMedia();
			media.add(MOTION_ALLOWED, animate);
			return () => media.revert();
		},
		{ scope }
	);
}

export { gsap, ScrollTrigger };
