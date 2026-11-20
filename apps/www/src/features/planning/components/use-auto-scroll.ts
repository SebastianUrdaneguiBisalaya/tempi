'use client';

import type { RefObject } from 'react';
import { gsap, useMotion } from '@/lib/gsap';

// Pixels a second, about a reader's pace.
const SPEED = 36;

/**
 * Scrolls the first child of `viewport` through it and back while it's on screen, like someone reading a panel taller
 * than the cell. Starts once `ready` (the content has rendered); with reduced motion the top stays in view.
 */
export function useAutoScroll(viewport: RefObject<HTMLElement | null>, ready: boolean) {
	useMotion(viewport, () => {
		const frame = viewport.current;
		const content = frame?.firstElementChild;
		if (!ready || !frame || !(content instanceof HTMLElement)) return;
		const distance = content.scrollHeight - frame.clientHeight;
		if (distance <= 0) return;
		gsap.to(content, {
			y: -distance,
			duration: distance / SPEED,
			ease: 'none',
			delay: 1.5,
			repeat: -1,
			repeatDelay: 1.5,
			yoyo: true,
			scrollTrigger: { trigger: frame, start: 'top 85%', end: 'bottom 15%', toggleActions: 'play pause resume pause' },
		});
	}, [ready]);
}
