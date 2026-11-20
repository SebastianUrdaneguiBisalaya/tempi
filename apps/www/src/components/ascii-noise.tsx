'use client';

import { cn } from 'cn';
import { useEffect, useRef } from 'react';
import { mountAsciiField } from '@/lib/ascii-field';

type AsciiNoiseProps = {
	/** Scales the noise's opacity; 1 matches the wordmark band. */
	opacity: number;
	/**
	 * Lights the noise around the mouse, like the wordmark band. The field sits behind content and ignores the pointer,
	 * so the mouse is followed over its parent element.
	 */
	spotlight?: boolean;
	/** Positions and sizes the field; it must be a positioned element. */
	className?: string;
};

/** A decorative, flickering field of faint bracket characters, the wordmark band's background on its own. */
export function AsciiNoise({ opacity, spotlight = false, className }: AsciiNoiseProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glowRef = useRef<HTMLDivElement>(null);

	// The canvas is an external system: the field draws it and keeps it in step with its size, visibility and the mouse.
	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!container || !canvas) return;
		const glow = spotlight ? (glowRef.current ?? undefined) : undefined;
		return mountAsciiField({ container, canvas, noiseOpacity: opacity, glow, pointerArea: container.parentElement ?? container });
	}, [opacity, spotlight]);

	return (
		<div ref={containerRef} aria-hidden className={cn('pointer-events-none overflow-hidden', className)}>
			{spotlight && (
				// A faint lift of the background under the spotlight; the canvas brightens the glyphs themselves.
				<div
					ref={glowRef}
					className='absolute inset-0 opacity-0 [background:radial-gradient(circle_var(--spot-radius,0px)_at_var(--spot-x,0px)_var(--spot-y,0px),rgb(255_255_255/0.06),transparent)]'
				/>
			)}
			<canvas ref={canvasRef} className='absolute inset-0 size-full font-mono' />
		</div>
	);
}
