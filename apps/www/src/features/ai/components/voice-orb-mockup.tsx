'use client';

import { cn } from 'cn';
import { useId, useRef } from 'react';
import { gsap, useMotion } from '@/lib/gsap';

export const VOICE_PHASES = ['idle', 'listening', 'thinking', 'speaking'] as const;

export type VoicePhase = (typeof VOICE_PHASES)[number];

/** How fast the gradient turns in each phase, relative to idle. */
const SPIN_SPEED = { idle: 1, listening: 2.5, speaking: 2, thinking: 6 } as const satisfies Record<VoicePhase, number>;

// Soft fields from white to near black that blend into a mesh; two layers turning in opposite directions keep it from
// looking like a wheel. Without hue, the motion reads only through the contrast between light and dark.
const MESH_A =
	'radial-gradient(circle at 25% 30%, oklch(0.97 0 0) 0%, transparent 45%), radial-gradient(circle at 75% 25%, oklch(0.62 0 0) 0%, transparent 45%), radial-gradient(circle at 70% 78%, oklch(0.25 0 0) 0%, transparent 45%), radial-gradient(circle at 25% 75%, oklch(0.8 0 0) 0%, transparent 45%)';
const MESH_B = 'radial-gradient(circle at 60% 40%, oklch(1 0 0 / 0.8) 0%, transparent 35%), radial-gradient(circle at 35% 60%, oklch(0.15 0 0 / 0.9) 0%, transparent 40%)';

/**
 * Replica of the app's voice orb. The app follows the microphone and the speech; here the levels are simulated with
 * random pulses. With reduced motion it stays still.
 */
export function VoiceOrbMockup({ phase }: { phase: VoicePhase }) {
	const root = useRef<HTMLDivElement>(null);
	const spin = useRef<gsap.core.Timeline | null>(null);
	const grainId = useId();

	useMotion(root, () => {
		spin.current = gsap
			.timeline({ defaults: { duration: 24, ease: 'none' }, repeat: -1 })
			.to('[data-orb=mesh-a]', { rotation: 360 }, 0)
			.to('[data-orb=mesh-b]', { rotation: -360 }, 0);
		return () => {
			spin.current = null;
		};
	});

	// Everything else belongs to one phase and is undone when the phase changes.
	useMotion(root, () => {
		if (spin.current !== null) gsap.to(spin.current, { duration: 0.8, ease: 'power2.out', timeScale: SPIN_SPEED[phase] });
		if (phase === 'idle') gsap.to('[data-orb=core]', { duration: 3, ease: 'sine.inOut', repeat: -1, scale: 1.04, yoyo: true });
		if (phase === 'thinking') gsap.to('[data-orb=halo]', { duration: 0.9, ease: 'sine.inOut', opacity: 0.7, repeat: -1, scale: 1.15, yoyo: true });
		if (phase === 'listening' || phase === 'speaking') {
			gsap.to('[data-orb=core]', { duration: 0.2, ease: 'power3.out', repeat: -1, repeatRefresh: true, scale: 'random(1, 1.1)' });
			gsap.to('[data-orb=halo]', { duration: 0.35, ease: 'power3.out', opacity: 'random(0.3, 0.75)', repeat: -1, repeatRefresh: true, scale: 'random(1.05, 1.3)' });
		}
	}, [phase]);

	return (
		<div ref={root} data-phase={phase} className='relative flex size-36 shrink-0 items-center justify-center rounded-full sm:size-40'>
			<span className='absolute inset-0 rounded-full opacity-25 blur-2xl' data-orb='halo' style={{ background: MESH_A }} />
			<span className='relative block size-full rounded-full shadow-lg ring-1 ring-white/10' data-orb='core'>
				{/* iOS WebKit ignores a rounded overflow clip over blurred, blended and rotated layers and shows a square.
				    clip-path clips them on every engine (an inner layer, so the ring and shadow stay outside the clip), and
				    isolate keeps the blend modes inside the orb. */}
				<span className='absolute inset-0 isolate overflow-hidden rounded-full [clip-path:circle(50%)]'>
					<span className='absolute -inset-1/4 bg-[oklch(0.5_0_0)] blur-md' data-orb='mesh-a' style={{ backgroundImage: MESH_A }} />
					<span className='absolute -inset-1/4 mix-blend-soft-light blur-lg' data-orb='mesh-b' style={{ backgroundImage: MESH_B }} />
					{/* Grain: fractal noise over the gradient, so it reads as a surface rather than a flat blur. */}
					<svg aria-hidden className='absolute inset-0 size-full opacity-40 mix-blend-overlay' preserveAspectRatio='none'>
						<filter id={grainId}>
							<feTurbulence baseFrequency='0.9' numOctaves='3' stitchTiles='stitch' type='fractalNoise' />
							<feColorMatrix type='saturate' values='0' />
						</filter>
						<rect filter={`url(#${grainId})`} height='100%' width='100%' />
					</svg>
					<span className={cn('absolute inset-0 rounded-full bg-radial from-white/25 to-transparent to-60%', phase === 'idle' ? 'opacity-60' : 'opacity-30')} />
				</span>
			</span>
		</div>
	);
}
