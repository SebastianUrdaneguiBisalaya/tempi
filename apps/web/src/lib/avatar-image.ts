import { type AvatarImage, MAX_AVATAR_BYTES } from '@tempi/core';

/** Stored avatars are small squares: enough for any avatar size on a high-density screen. */
const SIZE = 256;
const QUALITY = 0.9;

/**
 * Decodes an image file, crops its center to a square and re-encodes it as a small WebP.
 * Resolves to the image to store plus a blob to preview it; rejects when the file isn't a decodable image.
 */
export const toAvatarImage = async (file: Blob): Promise<{ blob: Blob; image: AvatarImage }> => {
	const bitmap = await createImageBitmap(file);
	try {
		const side = Math.min(bitmap.width, bitmap.height);
		const canvas = new OffscreenCanvas(SIZE, SIZE);
		const context = canvas.getContext('2d');
		if (context === null) throw new Error('2D canvas is unavailable');
		context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
		const blob = await canvas.convertToBlob({ quality: QUALITY, type: 'image/webp' });
		if (blob.size > MAX_AVATAR_BYTES) throw new Error(`Avatar is ${blob.size} bytes after resizing`);
		return { blob, image: { bytes: new Uint8Array(await blob.arrayBuffer()), type: 'image/webp' } };
	} finally {
		bitmap.close();
	}
};

/** First letter of the first and last names, e.g. "AQ" for Ana Quispe. */
export const initials = (firstName: string, lastName: string): string =>
	[firstName, lastName]
		.map(name => Array.from(name.trim())[0] ?? '')
		.join('')
		.toLocaleUpperCase();
