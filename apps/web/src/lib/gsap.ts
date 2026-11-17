'use client';

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';

// Registered once here so every component imports GSAP from this module and never repeats the setup.
gsap.registerPlugin(useGSAP);

/** Animations run only under this query; with reduced motion everything stays in its resting state. */
export const MOTION_ALLOWED = '(prefers-reduced-motion: no-preference)';

export { gsap, useGSAP };
