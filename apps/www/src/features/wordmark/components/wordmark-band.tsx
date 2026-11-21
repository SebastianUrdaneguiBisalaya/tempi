'use client';

import { useEffect, useRef } from 'react';
import { mountAsciiField } from '@/lib/ascii-field';
import { measureMark, opaqueBounds } from '../ascii-mark';

const WORD = 'tempi';
const LOGO_SRC = '/tempi-icon.png';

// Half of clamp(11rem, 30vw, 28rem), the band's former height: the mark keeps that size while the band is taller.
const markHeight = (width: number) => Math.min(448, Math.max(176, width * 0.3)) / 2;

/** The Tempi logo and word drawn with a grid of bracket characters over faint noise, lit around the mouse. */
export function WordmarkBand({ label }: { label: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const labelRef = useRef<HTMLSpanElement>(null);
	const glowRef = useRef<HTMLDivElement>(null);

	// The canvas is an external system: the field draws it once the logo and the heading font are in.
	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		const labelElement = labelRef.current;
		const glow = glowRef.current;
		if (!container || !canvas || !labelElement || !glow) return;

		// Read the family next/font generated, so the word uses the project's heading font.
		const font = getComputedStyle(labelElement).fontFamily;
		const logo = new Image();
		logo.src = LOGO_SRC;
		let unmount: (() => void) | null = null;
		let cancelled = false;

		Promise.all([logo.decode(), document.fonts.load(`500 100px ${font}`)])
			.then(() => {
				if (cancelled) return;
				const logoBounds = opaqueBounds(logo);
				unmount = mountAsciiField({
					container,
					canvas,
					glow,
					measureMark: grid => measureMark(grid, { word: WORD, font, logo, logoBounds, markHeight: markHeight(container.clientWidth) }),
				});
			})
			.catch((error: unknown) => console.error('Could not draw the wordmark', error));

		return () => {
			cancelled = true;
			unmount?.();
		};
	}, []);

	return (
		// A short vertical fade: the noise fills the band's whole height and only its very edges blend into the page.
		<div ref={containerRef} role='img' aria-label={label} className='relative h-svh w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]'>
			{/* A faint lift of the background under the spotlight; the canvas brightens the glyphs themselves. */}
			<div
				ref={glowRef}
				aria-hidden
				className='pointer-events-none absolute inset-0 opacity-0 [background:radial-gradient(circle_var(--spot-radius,0px)_at_var(--spot-x,0px)_var(--spot-y,0px),rgb(255_255_255/0.12),transparent)]'
			/>
			<canvas ref={canvasRef} aria-hidden className='absolute inset-0 size-full font-mono' />
			{/* Only read for its computed font family; the accessible name is on the container. */}
			<span ref={labelRef} aria-hidden className='sr-only font-heading'>
				{label}
			</span>
		</div>
	);
}
