'use client';

import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { type Bounds, buildGrid, type Cell, cellsUnder, drawCell, type Grid, lightAt, opaqueBounds, randomCell, type Spotlight } from '../ascii-mark';

const WORD = 'tempi';
const LOGO_SRC = '/tempi-icon.png';
// The flicker redraws a few cells at a time, about twelve times a second.
const FLICKER_SECONDS = 0.08;
const FLICKER_SHARE = 0.012;

const glyphSize = (width: number) => Math.min(11, Math.max(7, width / 160));
// The spotlight under the mouse is several times the cursor's size.
const spotlightRadius = (width: number) => Math.min(160, Math.max(90, width / 10));
// Half of clamp(11rem, 30vw, 28rem), the band's former height: the mark keeps that size while the band is taller.
const markHeight = (width: number) => Math.min(448, Math.max(176, width * 0.3)) / 2;

/** The Tempi logo and word drawn with a grid of bracket characters over faint noise, lit around the mouse. */
export function WordmarkBand({ label }: { label: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const labelRef = useRef<HTMLSpanElement>(null);
	const glowRef = useRef<HTMLDivElement>(null);

	// The canvas is an external system: this effect draws it and keeps it in step with size, visibility, the mouse and motion settings.
	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		const labelElement = labelRef.current;
		const glow = glowRef.current;
		const context = canvas?.getContext('2d');
		if (!container || !canvas || !labelElement || !glow || !context) return;

		// Read the families next/font generated, so the canvas uses the project's fonts.
		const headingFont = getComputedStyle(labelElement).fontFamily;
		const monoFont = getComputedStyle(canvas).fontFamily;
		const logo = new Image();
		logo.src = LOGO_SRC;
		const logoReady = Promise.all([logo.decode(), document.fonts.load(`500 100px ${headingFont}`), document.fonts.load(`10px ${monoFont}`)]).then(() => opaqueBounds(logo));

		// Rebuilt when the visitor changes their motion setting: the flicker stops and the spotlight snaps instead of easing.
		const media = gsap.matchMedia();
		media.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
			const motion = Boolean(conditions?.motion);
			const ease = { duration: motion ? 0.35 : 0, ease: 'power3.out' };
			let grid: Grid | null = null;
			let cells: Cell[] = [];
			let logoBounds: Bounds | null = null;
			let spotlight: Spotlight | null = null;
			let lit: number[] = [];
			let dirty = false;
			let sinceFlicker = 0;
			let reverted = false;
			let visibility: ScrollTrigger | null = null;

			// GSAP eases the spotlight's position and strength; the ticker repaints once per frame after they change.
			const spot = { x: 0, y: 0, strength: 0 };
			const markDirty = () => {
				dirty = true;
			};
			const moveX = gsap.quickTo(spot, 'x', { ...ease, onUpdate: markDirty });
			const moveY = gsap.quickTo(spot, 'y', { ...ease, onUpdate: markDirty });

			const paint = (index: number) => {
				if (grid) drawCell(context, grid, index, cells[index] ?? null, lightAt(grid, index, spotlight));
			};

			const render = () => {
				const { width, height } = container.getBoundingClientRect();
				if (width === 0 || height === 0 || !logoBounds) return;
				const ratio = window.devicePixelRatio || 1;
				canvas.width = Math.round(width * ratio);
				canvas.height = Math.round(height * ratio);
				context.setTransform(ratio, 0, 0, ratio, 0, 0);

				const size = glyphSize(width);
				context.font = `${size}px ${monoFont}`;
				const cellWidth = context.measureText('[').width;
				const next = buildGrid({ width, height, cellWidth, cellHeight: size * 1.3, word: WORD, font: headingFont, logo, logoBounds, markHeight: markHeight(width) });
				grid = next;
				lit = [];
				dirty = true;

				// Resizing the canvas resets its state, so the text settings go back after it.
				context.font = `${size}px ${monoFont}`;
				context.fillStyle = '#fff';
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				cells = Array.from({ length: next.cols * next.rows }, (_, index) => randomCell(next, index));
				for (const index of cells.keys()) paint(index);
			};

			// Repaints the cells under the old and the new spotlight, so the light follows the mouse and leaves nothing behind.
			const repaintSpotlight = () => {
				if (!grid) return;
				const radius = spotlightRadius(container.clientWidth);
				spotlight = spot.strength > 0.001 ? { x: spot.x, y: spot.y, radius, strength: spot.strength } : null;
				const previous = lit;
				lit = spotlight ? cellsUnder(grid, spotlight) : [];
				for (const index of new Set([...previous, ...lit])) paint(index);
				gsap.set(glow, { opacity: spot.strength, '--spot-x': `${spot.x}px`, '--spot-y': `${spot.y}px`, '--spot-radius': `${radius * 1.4}px` });
			};

			const tick = (_time: number, deltaTime: number) => {
				if (!grid) return;
				if (dirty) {
					dirty = false;
					repaintSpotlight();
				}
				if (!motion) return;
				sinceFlicker += deltaTime / 1000;
				if (sinceFlicker < FLICKER_SECONDS) return;
				sinceFlicker = 0;
				const changes = Math.max(1, Math.round(cells.length * FLICKER_SHARE));
				for (let change = 0; change < changes; change++) {
					const index = Math.floor(Math.random() * cells.length);
					cells[index] = randomCell(grid, index);
					paint(index);
				}
			};

			const onPointerMove = (event: PointerEvent) => {
				// Touch has no hover; a tap shouldn't leave a light behind.
				if (event.pointerType !== 'mouse') return;
				const bounds = container.getBoundingClientRect();
				const x = event.clientX - bounds.left;
				const y = event.clientY - bounds.top;
				// Entering, the light appears under the mouse instead of sliding in from where it last left.
				const entering = spot.strength === 0;
				moveX(x, entering ? x : undefined);
				moveY(y, entering ? y : undefined);
				gsap.to(spot, { strength: 1, ...ease, overwrite: 'auto', onUpdate: markDirty });
			};

			const onPointerLeave = () => {
				gsap.to(spot, { strength: 0, ...ease, overwrite: 'auto', onUpdate: markDirty });
			};

			const resizeObserver = new ResizeObserver(render);
			container.addEventListener('pointermove', onPointerMove);
			container.addEventListener('pointerleave', onPointerLeave);

			logoReady
				.then(bounds => {
					if (reverted) return;
					logoBounds = bounds;
					// Observing draws the first frame: the observer reports the current size right away.
					resizeObserver.observe(container);
					// Only spend frames while the band is on screen.
					visibility = ScrollTrigger.create({
						trigger: container,
						start: 'top bottom',
						end: 'bottom top',
						onToggle: ({ isActive }) => (isActive ? gsap.ticker.add(tick) : gsap.ticker.remove(tick)),
					});
				})
				.catch((error: unknown) => console.error('Could not draw the wordmark', error));

			return () => {
				reverted = true;
				gsap.ticker.remove(tick);
				gsap.killTweensOf(spot);
				visibility?.kill();
				resizeObserver.disconnect();
				container.removeEventListener('pointermove', onPointerMove);
				container.removeEventListener('pointerleave', onPointerLeave);
			};
		});

		return () => media.revert();
	}, []);

	return (
		// A short vertical fade: the noise fills the band's whole height and only its very edges blend into the page.
		<div
			ref={containerRef}
			role='img'
			aria-label={label}
			className='relative h-[clamp(14rem,38vw,36rem)] w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]'
		>
			{/* A faint lift of the background under the spotlight; the canvas brightens the glyphs themselves. */}
			<div
				ref={glowRef}
				aria-hidden
				className='pointer-events-none absolute inset-0 opacity-0 [background:radial-gradient(circle_var(--spot-radius,0px)_at_var(--spot-x,0px)_var(--spot-y,0px),rgb(255_255_255/0.06),transparent)]'
			/>
			<canvas ref={canvasRef} aria-hidden className='absolute inset-0 size-full font-mono' />
			{/* Only read for its computed font family; the accessible name is on the container. */}
			<span ref={labelRef} aria-hidden className='sr-only font-heading'>
				{label}
			</span>
		</div>
	);
}
