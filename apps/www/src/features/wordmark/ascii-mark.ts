const GLYPHS = ['[', ']', '.', ':'] as const;
// The mask is drawn this many times finer than the grid, so each cell gets a coverage between 0 and 1.
const SUPERSAMPLE = 4;
// Share of the band's width the logo and the word may take.
const MAX_WIDTH = 0.8;

export type Cell = { glyph: string; alpha: number } | null;

export type Grid = {
	cols: number;
	rows: number;
	cellWidth: number;
	cellHeight: number;
	offsetX: number;
	offsetY: number;
	/** How much of each cell the mark covers, row by row. */
	coverage: Float32Array;
};

export type Bounds = { x: number; y: number; width: number; height: number };

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? '.';

/** The box of the logo's visible pixels: the PNG has wide transparent margins. */
export function opaqueBounds(image: HTMLImageElement): Bounds {
	const canvas = document.createElement('canvas');
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
	context.drawImage(image, 0, 0);
	const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
	let left = width;
	let top = height;
	let right = -1;
	let bottom = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if ((data[(y * width + x) * 4 + 3] ?? 0) < 16) continue;
			if (x < left) left = x;
			if (x > right) right = x;
			if (y < top) top = y;
			if (y > bottom) bottom = y;
		}
	}
	if (right < 0) return { x: 0, y: 0, width, height };
	return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

type MarkOptions = {
	width: number;
	height: number;
	cellWidth: number;
	cellHeight: number;
	word: string;
	font: string;
	logo: HTMLImageElement;
	logoBounds: Bounds;
	/** The tallest the logo and the word may be, in CSS pixels; kept apart from the band's height so the band can grow alone. */
	markHeight: number;
};

/** Lays the logo and the word out in the middle of the band and measures how much of each grid cell they cover. */
export function buildGrid({ width, height, cellWidth, cellHeight, word, font, logo, logoBounds, markHeight }: MarkOptions): Grid {
	const cols = Math.max(1, Math.floor(width / cellWidth));
	const rows = Math.max(1, Math.floor(height / cellHeight));
	const gridWidth = cols * cellWidth;
	const gridHeight = rows * cellHeight;
	const grid: Grid = { cols, rows, cellWidth, cellHeight, offsetX: (width - gridWidth) / 2, offsetY: (height - gridHeight) / 2, coverage: new Float32Array(cols * rows) };

	const canvas = document.createElement('canvas');
	canvas.width = cols * SUPERSAMPLE;
	canvas.height = rows * SUPERSAMPLE;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) return grid;
	// Draw in CSS pixels; the mask's pixels are not square because the cells aren't.
	context.scale(SUPERSAMPLE / cellWidth, SUPERSAMPLE / cellHeight);

	const reference = 100;
	context.font = `500 ${reference}px ${font}`;
	const metrics = context.measureText(word);
	const ascent = metrics.actualBoundingBoxAscent;
	const descent = metrics.actualBoundingBoxDescent;
	const textWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
	const textHeight = ascent + descent;
	const logoHeight = textHeight;
	const logoWidth = (logoHeight * logoBounds.width) / logoBounds.height;
	const gap = reference * 0.22;
	const scale = Math.min((gridWidth * MAX_WIDTH) / (logoWidth + gap + textWidth), markHeight / textHeight);

	const left = (gridWidth - (logoWidth + gap + textWidth) * scale) / 2;
	const top = (gridHeight - textHeight * scale) / 2;
	context.fillStyle = '#fff';
	context.drawImage(logo, logoBounds.x, logoBounds.y, logoBounds.width, logoBounds.height, left, top, logoWidth * scale, logoHeight * scale);
	context.font = `500 ${reference * scale}px ${font}`;
	context.textBaseline = 'alphabetic';
	context.fillText(word, left + (logoWidth + gap + metrics.actualBoundingBoxLeft) * scale, top + ascent * scale);

	const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
	const samples = SUPERSAMPLE * SUPERSAMPLE * 255;
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			let sum = 0;
			for (let y = 0; y < SUPERSAMPLE; y++) {
				for (let x = 0; x < SUPERSAMPLE; x++) sum += data[((row * SUPERSAMPLE + y) * canvas.width + col * SUPERSAMPLE + x) * 4 + 3] ?? 0;
			}
			grid.coverage[row * cols + col] = sum / samples;
		}
	}
	return grid;
}

/** A random cell: bright inside the mark, soft on its edges, faint and sparse noise elsewhere. */
export function randomCell(grid: Grid, index: number): Cell {
	const coverage = grid.coverage[index] ?? 0;
	const roll = Math.random();
	if (coverage > 0.45) return { glyph: randomGlyph(), alpha: roll < 0.1 ? 0.5 : 0.8 + Math.random() * 0.2 };
	if (coverage > 0.12) return { glyph: randomGlyph(), alpha: 0.25 + coverage * 0.6 };
	if (roll > 0.42) return null;
	return { glyph: randomGlyph(), alpha: 0.05 + Math.random() * 0.13 };
}

/** `strength` (0 to 1) scales the whole light, so it can fade in and out. */
export type Spotlight = { x: number; y: number; radius: number; strength: number };

const cellCenter = (grid: Grid, index: number) => ({
	x: grid.offsetX + ((index % grid.cols) + 0.5) * grid.cellWidth,
	y: grid.offsetY + (Math.floor(index / grid.cols) + 0.5) * grid.cellHeight,
});

/** How lit a cell is by the spotlight: its strength at the center, easing to 0 at its edge. */
export function lightAt(grid: Grid, index: number, spotlight: Spotlight | null) {
	if (!spotlight) return 0;
	const center = cellCenter(grid, index);
	const distance = Math.hypot(center.x - spotlight.x, center.y - spotlight.y) / spotlight.radius;
	if (distance >= 1) return 0;
	const falloff = 1 - distance;
	return falloff * falloff * (3 - 2 * falloff) * spotlight.strength;
}

/** The indices of the cells a spotlight touches. */
export function cellsUnder(grid: Grid, spotlight: Spotlight) {
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
 * lifts to a soft grey. The context's font, color and alignment are set by the caller.
 */
export function drawCell(context: CanvasRenderingContext2D, grid: Grid, index: number, cell: Cell, light = 0) {
	const { x, y } = cellCenter(grid, index);
	context.clearRect(x - grid.cellWidth / 2, y - grid.cellHeight / 2, grid.cellWidth, grid.cellHeight);
	if (!cell || cell.alpha <= 0) return;
	const target = (grid.coverage[index] ?? 0) > 0.12 ? 1 : 0.5;
	context.globalAlpha = cell.alpha + Math.max(0, target - cell.alpha) * light;
	context.fillText(cell.glyph, x, y);
}
