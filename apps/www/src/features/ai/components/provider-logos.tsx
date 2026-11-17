import { AnthropicDark, Gemini, Groq, OpenAIDark, XAIDark } from '@ridemountainpig/svgl-react';
import type { SVGProps } from 'react';

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
export const PROVIDERS = [
	{ name: 'OpenAI', Logo: OpenAIDark },
	{ name: 'Anthropic', Logo: AnthropicDark },
	{ name: 'Google Gemini', Logo: Gemini },
	{ name: 'xAI', Logo: XAIDark },
	{ name: 'Groq', Logo: Groq },
	{ name: 'ElevenLabs', Logo: ElevenLabsMark },
] as const;

/** Each provider's logo with its name, in grayscale so the colored ones sit quietly on the dark page. */
export function ProviderLogos({ label }: { label: string }) {
	return (
		<ul aria-label={label} className='flex flex-wrap gap-2'>
			{PROVIDERS.map(({ name, Logo }) => (
				<li key={name} className='flex items-center gap-2 rounded-full border bg-muted/20 py-1 pr-3 pl-2 text-sm text-foreground/85'>
					<Logo aria-hidden className='size-4 shrink-0 text-foreground grayscale brightness-150' />
					{name}
				</li>
			))}
		</ul>
	);
}
