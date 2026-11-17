import type { SVGProps } from 'react';

/** The ElevenLabs mark (two bars). svgl-react doesn't ship it; `currentColor` follows the theme. */
export function ElevenLabsLogo(props: SVGProps<SVGSVGElement>) {
	return (
		<svg fill='currentColor' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' {...props}>
			<rect height='20' rx='0.5' width='3.5' x='6' y='2' />
			<rect height='20' rx='0.5' width='3.5' x='14.5' y='2' />
		</svg>
	);
}
