import { gsap } from '@/lib/gsap';
import { loadFont } from '@/lib/load-font';

const GLYPHS = ['[', ']', '.', ':'] as const;
// The flicker redraws a few cells at a time, about twelve times a second.
const FLICKER_SECONDS = 0.08;
const FLICKER_SHARE = 0.012;

export type Cell = { glyph: string; alpha: number } | null;

export type Grid = {
	cols: number;
	rows: number;
	cellWidth: number;
	cellHeight: number;
	offsetX: number;
	offsetY: number;
	/** How much of each cell a mark covers (0 to 1), row by row; all 0 for plain noise. */
	coverage: Float32Array;
};

/** `strength` (0 to 1) scales the whole light, so it can fade in and out. */
export type Spotlight = { x: number; y: number; radius: number; strength: number };

const glyphSize = (width: number) => Math.min(11, Math.max(7, width / 160));
// The spotlight under the mouse is several times the cursor's size.
const spotlightRadius = (width: number) => Math.min(160, Math.max(90, width / 10));
const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? '.';

/** A grid of whole cells centered in `width` × `height`. */
function createGrid(width: number, height: number, cellWidth: number, cellHeight: number): Grid {
	const cols = Math.max(1, Math.floor(width / cellWidth));
	const rows = Math.max(1, Math.floor(height / cellHeight));
	return { cols, rows, cellWidth, cellHeight, offsetX: (width - cols * cellWidth) / 2, offsetY: (height - rows * cellHeight) / 2, coverage: new Float32Array(cols * rows) };
}

/** A random cell: bright inside the mark, soft on its edges, faint and sparse noise elsewhere. */
function randomCell(grid: Grid, index: number, noiseOpacity: number): Cell {
	const coverage = grid.coverage[index] ?? 0;
	const roll = Math.random();
	if (coverage > 0.45) return { glyph: randomGlyph(), alpha: roll < 0.1 ? 0.5 : 0.8 + Math.random() * 0.2 };
	if (coverage > 0.12) return { glyph: randomGlyph(), alpha: 0.25 + coverage * 0.6 };
	if (roll > 0.42) return null;
	return { glyph: randomGlyph(), alpha: (0.05 + Math.random() * 0.13) * noiseOpacity };
}

const cellCenter = (grid: Grid, index: number) => ({
	x: grid.offsetX + ((index % grid.cols) + 0.5) * grid.cellWidth,
	y: grid.offsetY + (Math.floor(index / grid.cols) + 0.5) * grid.cellHeight,
});

/** How lit a cell is by the spotlight: its strength at the center, easing to 0 at its edge. */
function lightAt(grid: Grid, index: number, spotlight: Spotlight | null) {
	if (!spotlight) return 0;
	const center = cellCenter(grid, index);
	const distance = Math.hypot(center.x - spotlight.x, center.y - spotlight.y) / spotlight.radius;
	if (distance >= 1) return 0;
	const falloff = 1 - distance;
	return falloff * falloff * (3 - 2 * falloff) * spotlight.strength;
}

/** The indices of the cells a spotlight touches. */
function cellsUnder(grid: Grid, spotlight: Spotlight) {
	const indices: number[] = [];
	const firstCol = Math.max(0, Math.floor((spotlight.x - spotlight.radius - grid.offsetX) / grid.cellWidth));
	const lastCol = Math.min(grid.cols - 1, Math.floor((spotlight.x + spotlight.radius - grid.offsetX) / grid.cellWidth));
	const firstRow = Math.max(0, Math.floor((spotlight.y - spotlight.radius - grid.offsetY) / grid.cellHeight));
	const lastRow = Math.min(grid.rows - 1, Math.floor((spotlight.y + spotlight.radius - grid.offsetY) / grid.cellHeight));
	for (let row = firstRow; row <= lastRow; row++) {
		for (let col = firstCol; col <= lastCol; col++) indices.push(row * grid.cols + col);
	}
	return indices;
}

/**
 * Clears one cell and draws its glyph, brightened by `light` (0 to 1): the mark goes to full white and the noise
 * lifts to a clear light grey. The context's font, color and alignment are set by the caller.
 */
function drawCell(context: CanvasRenderingContext2D, grid: Grid, index: number, cell: Cell, light: number) {
	const { x, y } = cellCenter(grid, index);
	context.clearRect(x - grid.cellWidth / 2, y - grid.cellHeight / 2, grid.cellWidth, grid.cellHeight);
	if (!cell || cell.alpha <= 0) return;
	const target = (grid.coverage[index] ?? 0) > 0.12 ? 1 : 0.75;
	context.globalAlpha = cell.alpha + Math.max(0, target - cell.alpha) * light;
	context.fillText(cell.glyph, x, y);
}

export type AsciiFieldOptions = {
	/** Sized by this element; the canvas fills it. */
	container: HTMLElement;
	/** Its computed font family (the project's mono font) draws the glyphs. */
	canvas: HTMLCanvasElement;
	/** Scales the noise's opacity; the mark keeps its own. */
	noiseOpacity?: number;
	/** Fills `grid.coverage` with how much of each cell a mark covers; without it the field is only noise. */
	measureMark?: (grid: Grid) => void;
	/** An element whose radial glow follows the mouse with the light; without it there is no spotlight. */
	glow?: HTMLElement;
	/** Where the mouse is followed; defaults to the container. A field behind content listens on an element above it. */
	pointerArea?: HTMLElement;
};

/**
 * Draws a flickering grid of bracket characters into `canvas` and keeps it in step with the container's size, its
 * visibility, the mouse and the visitor's motion setting. Returns the cleanup.
 */
export function mountAsciiField({ container, canvas, noiseOpacity = 1, measureMark, glow, pointerArea = container }: AsciiFieldOptions): () => void {
	const context = canvas.getContext('2d');
	if (!context)
		return () => {
			// Nothing was drawn, so there is nothing to clean up.
		};
	const monoFont = getComputedStyle(canvas).fontFamily;
	const media = gsap.matchMedia();
	let unmounted = false;

	// Rebuilt when the visitor changes their motion setting: the flicker stops and the spotlight snaps instead of easing.
	const start = () =>
		media.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
			const motion = Boolean(conditions?.motion);
			const ease = { duration: motion ? 0.35 : 0, ease: 'power3.out' };
			let grid: Grid | null = null;
			let cells: Cell[] = [];
			let spotlight: Spotlight | null = null;
			let lit: number[] = [];
			let dirty = false;
			let sinceFlicker = 0;

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
				if (width === 0 || height === 0) return;
				const ratio = window.devicePixelRatio || 1;
				canvas.width = Math.round(width * ratio);
				canvas.height = Math.round(height * ratio);
				context.setTransform(ratio, 0, 0, ratio, 0, 0);

				const font = `${glyphSize(width)}px ${monoFont}`;
				context.font = font;
				const next = createGrid(width, height, context.measureText('[').width, glyphSize(width) * 1.3);
				measureMark?.(next);
				grid = next;
				lit = [];
				dirty = true;

				// Resizing the canvas resets its state, so the text settings go back after it.
				context.font = font;
				context.fillStyle = '#fff';
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				cells = Array.from({ length: next.cols * next.rows }, (_, index) => randomCell(next, index, noiseOpacity));
				for (const index of cells.keys()) paint(index);
			};

			// Repaints the cells under the old and the new spotlight, so the light follows the mouse and leaves nothing behind.
			const repaintSpotlight = () => {
				if (!grid || !glow) return;
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
					cells[index] = randomCell(grid, index, noiseOpacity);
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

			// Observing draws the first frame: the observer reports the current size right away.
			const resizeObserver = new ResizeObserver(render);
			resizeObserver.observe(container);
			if (glow) {
				pointerArea.addEventListener('pointermove', onPointerMove);
				pointerArea.addEventListener('pointerleave', onPointerLeave);
			}
			// Only spend frames while the field is on screen. An IntersectionObserver rather than a ScrollTrigger: it follows
			// a container whose height is set after mount (the hero's), where a trigger keeps its first, empty measurement.
			const visibility = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? gsap.ticker.add(tick) : gsap.ticker.remove(tick)));
			visibility.observe(container);

			return () => {
				gsap.ticker.remove(tick);
				gsap.killTweensOf(spot);
				visibility.disconnect();
				resizeObserver.disconnect();
				pointerArea.removeEventListener('pointermove', onPointerMove);
				pointerArea.removeEventListener('pointerleave', onPointerLeave);
			};
		});

	// Glyph widths are measured, so draw only once the mono font is in (or has failed, so the field still shows).
	loadFont(document.fonts, `10px ${monoFont}`).then(() => {
		if (!unmounted) start();
	});

	return () => {
		unmounted = true;
		media.revert();
	};
}
