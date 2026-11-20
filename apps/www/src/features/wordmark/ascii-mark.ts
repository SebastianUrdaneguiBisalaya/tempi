import type { Grid } from '@/lib/ascii-field';

// The mask is drawn this many times finer than the grid, so each cell gets a coverage between 0 and 1.
const SUPERSAMPLE = 4;
// Share of the band's width the logo and the word may take.
const MAX_WIDTH = 0.8;

export type Bounds = { x: number; y: number; width: number; height: number };

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
	word: string;
	font: string;
	logo: HTMLImageElement;
	logoBounds: Bounds;
	/** The tallest the logo and the word may be, in CSS pixels; kept apart from the band's height so the band can grow alone. */
	markHeight: number;
};

/** Lays the logo and the word out in the middle of the grid and writes how much of each cell they cover. */
export function measureMark(grid: Grid, { word, font, logo, logoBounds, markHeight }: MarkOptions) {
	const { cols, rows, cellWidth, cellHeight } = grid;
	const gridWidth = cols * cellWidth;
	const gridHeight = rows * cellHeight;

	const canvas = document.createElement('canvas');
	canvas.width = cols * SUPERSAMPLE;
	canvas.height = rows * SUPERSAMPLE;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) return;
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
}
