'use client';

import { AnthropicDark, Gemini, Groq, OpenAIDark, XAIDark } from '@ridemountainpig/svgl-react';
import { cn } from 'cn';
import { type SVGProps, useRef } from 'react';
import { gsap, useMotion } from '@/lib/gsap';

/** svgl has no ElevenLabs logo; its mark is two upright bars, drawn here in the current color. */
function ElevenLabsMark(props: SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox='0 0 24 24' fill='currentColor' {...props}>
			<rect x='6' y='3' width='4' height='18' rx='0.5' />
			<rect x='14' y='3' width='4' height='18' rx='0.5' />
		</svg>
	);
}

// Brand names stay the same in every language.
const PROVIDERS = [
	{ name: 'OpenAI', Logo: OpenAIDark },
	{ name: 'Anthropic', Logo: AnthropicDark },
	{ name: 'Google Gemini', Logo: Gemini },
	{ name: 'xAI', Logo: XAIDark },
	{ name: 'Groq', Logo: Groq },
	{ name: 'ElevenLabs', Logo: ElevenLabsMark },
] as const;

/**
 * Even count: the track slides by half its width, so its second half lands exactly where the first began. Four sets keep
 * that half wider than the section, so the row never shows a gap.
 */
const SETS = [0, 1, 2, 3] as const;

/**
 * The supported providers' logos, large and in grayscale, scrolling sideways without end while on screen. With reduced
 * motion one still set is shown. Assistive tech reads the names from a hidden list instead.
 */
export function ProviderMarquee({ label }: { label: string }) {
	const ref = useRef<HTMLDivElement>(null);

	useMotion(ref, () => {
		gsap.to('[data-marquee-track]', {
			xPercent: -50,
			duration: 40,
			ease: 'none',
			repeat: -1,
			scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', toggleActions: 'play pause resume pause' },
		});
	});

	return (
		<div ref={ref} className='mt-20 flex flex-col gap-8'>
			<p className='text-center text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>{label}</p>
			<ul aria-label={label} className='sr-only'>
				{PROVIDERS.map(({ name }) => (
					<li key={name}>{name}</li>
				))}
			</ul>
			{/* Fades at both edges, so logos slide in and out instead of being cut. */}
			<div aria-hidden className='overflow-hidden mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]'>
				<div data-marquee-track className='flex w-max motion-reduce:w-full motion-reduce:justify-center'>
					{SETS.map(set => (
						<div key={set} className={cn('flex shrink-0 items-center gap-16 pr-16 sm:gap-24 sm:pr-24', set > 0 && 'motion-reduce:hidden')}>
							{PROVIDERS.map(({ name, Logo }) => (
								<Logo key={name} className='size-10 shrink-0 text-foreground opacity-70 brightness-150 grayscale sm:size-12' />
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
