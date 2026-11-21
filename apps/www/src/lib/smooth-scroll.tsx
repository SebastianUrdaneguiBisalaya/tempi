'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';
import { gsap, ScrollTrigger } from '@/lib/gsap';

/**
 * Smooths wheel and trackpad scrolling for the whole page. Lenis is an external system, so it lives in an effect and is
 * driven by GSAP's ticker: ScrollTrigger then reads the same scroll position the visitor sees. Touch stays native, and
 * with reduced motion Lenis scrolls 1:1 on its own. An element that scrolls by itself opts out with `data-lenis-prevent`.
 */
export function SmoothScroll() {
	useEffect(() => {
		// Anchors keep honoring `scroll-margin-top`, so sections still stop below the floating header.
		const lenis = new Lenis({ anchors: true, autoRaf: false, duration: 1.1 });
		const update = (time: number) => lenis.raf(time * 1000);
		lenis.on('scroll', ScrollTrigger.update);
		gsap.ticker.add(update);
		// A frame skipped by a busy tab must not turn into a jump.
		gsap.ticker.lagSmoothing(0);

		return () => {
			gsap.ticker.remove(update);
			lenis.destroy();
		};
	}, []);

	return null;
}
