import { AnthropicDark, Gemini, Groq, OpenAIDark, XAIDark } from '@ridemountainpig/svgl-react';
import type { SVGProps } from 'react';
import { Marquee } from '@/components/marquee';

/** svgl has no ElevenLabs logo; its mark is two upright bars, drawn here in the current color. */
export function ElevenLabsMark(props: SVGProps<SVGSVGElement>) {
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
 * The supported providers' logos, large and in grayscale, sliding sideways without end. Assistive tech reads the names
 * from a hidden list instead.
 */
export function ProviderMarquee({ label }: { label: string }) {
	return (
		<div className='mt-20 flex flex-col gap-8'>
			<p className='text-center text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>{label}</p>
			<ul aria-label={label} className='sr-only'>
				{PROVIDERS.map(({ name }) => (
					<li key={name}>{name}</li>
				))}
			</ul>
			{/* Fades at both edges, so logos slide in and out instead of being cut. */}
			<Marquee className='mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] [--duration:30s] [--gap:4rem] sm:[--gap:6rem]'>
				{PROVIDERS.map(({ name, Logo }) => (
					<Logo key={name} className='size-10 shrink-0 text-foreground opacity-70 brightness-150 grayscale sm:size-12' />
				))}
			</Marquee>
		</div>
	);
}
