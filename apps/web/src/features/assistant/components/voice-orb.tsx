'use client';

import { cn } from 'cn';
import { useId, useRef } from 'react';
import { gsap, MOTION_ALLOWED, useGSAP } from '@/lib/gsap';
import type { VoicePhase } from '../voice-store';
import { useVoiceLevels } from './assistant-provider';

/** How fast the gradient turns in each phase, relative to idle. */
const SPIN_SPEED = { idle: 1, listening: 2.5, speaking: 2, thinking: 6 } as const satisfies Record<VoicePhase, number>;

// Soft fields from white to near black that blend into a mesh; two layers turning in opposite directions keep it from
// looking like a wheel. Without hue, the motion reads only through the contrast between light and dark.
const MESH_A =
	'radial-gradient(circle at 25% 30%, oklch(0.97 0 0) 0%, transparent 45%), radial-gradient(circle at 75% 25%, oklch(0.62 0 0) 0%, transparent 45%), radial-gradient(circle at 70% 78%, oklch(0.25 0 0) 0%, transparent 45%), radial-gradient(circle at 25% 75%, oklch(0.8 0 0) 0%, transparent 45%)';
const MESH_B = 'radial-gradient(circle at 60% 40%, oklch(1 0 0 / 0.8) 0%, transparent 35%), radial-gradient(circle at 35% 60%, oklch(0.15 0 0 / 0.9) 0%, transparent 40%)';

type VoiceOrbProps = {
	phase: VoicePhase;
	label: string;
	disabled: boolean;
	onTap: () => void;
};

/**
 * The Voice tab's control: a mesh-gradient orb with grain that talks, sends, cancels or stops speaking. It turns
 * faster while busy, pulses while thinking and follows the microphone or the speech while listening or speaking. With
 * reduced motion it stays still.
 */
export function VoiceOrb({ disabled, label, onTap, phase }: VoiceOrbProps) {
	const root = useRef<HTMLButtonElement>(null);
	const spin = useRef<gsap.core.Timeline | null>(null);
	const grainId = useId();
	const levels = useVoiceLevels();

	// The gradient never stops turning; each phase only changes how fast.
	useGSAP(
		() => {
			const media = gsap.matchMedia();
			media.add(MOTION_ALLOWED, () => {
				spin.current = gsap
					.timeline({ defaults: { duration: 24, ease: 'none' }, repeat: -1 })
					.to('[data-orb=mesh-a]', { rotation: 360 }, 0)
					.to('[data-orb=mesh-b]', { rotation: -360 }, 0);
				return () => {
					spin.current = null;
				};
			});
			return () => media.revert();
		},
		{ scope: root }
	);

	// Everything else belongs to one phase and is undone when the phase changes.
	useGSAP(
		() => {
			const media = gsap.matchMedia();
			media.add(MOTION_ALLOWED, () => {
				if (spin.current !== null) gsap.to(spin.current, { duration: 0.8, ease: 'power2.out', timeScale: SPIN_SPEED[phase] });
				if (phase === 'idle') gsap.to('[data-orb=core]', { duration: 3, ease: 'sine.inOut', repeat: -1, scale: 1.04, yoyo: true });
				if (phase === 'thinking') gsap.to('[data-orb=halo]', { duration: 0.9, ease: 'sine.inOut', opacity: 0.7, repeat: -1, scale: 1.15, yoyo: true });
				if (phase !== 'listening' && phase !== 'speaking') return;
				const source = levels[phase];
				const toCore = gsap.quickTo('[data-orb=core]', 'scale', { duration: 0.2, ease: 'power3.out' });
				const toHalo = gsap.quickTo('[data-orb=halo]', 'scale', { duration: 0.35, ease: 'power3.out' });
				const toGlow = gsap.quickTo('[data-orb=halo]', 'opacity', { duration: 0.35, ease: 'power3.out' });
				return source.subscribe(() => {
					const level = source.get();
					toCore(1 + level * 0.12);
					toHalo(1 + level * 0.35);
					toGlow(0.25 + level * 0.6);
				});
			});
			return () => media.revert();
		},
		{ dependencies: [phase], revertOnUpdate: true, scope: root }
	);

	return (
		<button
			aria-label={label}
			aria-pressed={phase === 'listening'}
			className='group relative flex size-40 shrink-0 items-center justify-center rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:size-44'
			data-phase={phase}
			disabled={disabled}
			onClick={onTap}
			ref={root}
			title={label}
			type='button'
		>
			<span aria-hidden className='absolute inset-0 rounded-full opacity-25 blur-2xl' data-orb='halo' style={{ background: MESH_A }} />
			<span
				aria-hidden
				className='relative block size-full overflow-hidden rounded-full shadow-lg ring-1 ring-black/5 transition-[box-shadow] group-focus-visible:ring-4 group-focus-visible:ring-ring/60 motion-reduce:transition-none dark:ring-white/10'
				data-orb='core'
			>
				<span className='absolute -inset-1/4 bg-[oklch(0.5_0_0)] blur-md' data-orb='mesh-a' style={{ backgroundImage: MESH_A }} />
				<span className='absolute -inset-1/4 mix-blend-soft-light blur-lg' data-orb='mesh-b' style={{ backgroundImage: MESH_B }} />
				{/* Grain: fractal noise over the gradient, so it reads as a surface rather than a flat blur. */}
				<svg className='absolute inset-0 size-full opacity-40 mix-blend-overlay' preserveAspectRatio='none'>
					<filter id={grainId}>
						<feTurbulence baseFrequency='0.9' numOctaves='3' stitchTiles='stitch' type='fractalNoise' />
						<feColorMatrix type='saturate' values='0' />
					</filter>
					<rect filter={`url(#${grainId})`} height='100%' width='100%' />
				</svg>
				<span className={cn('absolute inset-0 rounded-full bg-radial from-white/25 to-transparent to-60%', phase === 'idle' ? 'opacity-60' : 'opacity-30')} />
			</span>
		</button>
	);
}
