import { describe, expect, test } from 'bun:test';
import { loadFont } from './load-font';

describe('loadFont', () => {
	test('resolves once the font loads', async () => {
		const requested: string[] = [];
		const fonts = {
			load: (font: string) => {
				requested.push(font);
				return Promise.resolve([]);
			},
		};
		await expect(loadFont(fonts, '10px "Geist Mono"')).resolves.toBeUndefined();
		expect(requested).toEqual(['10px "Geist Mono"']);
	});

	test('resolves when a face fails to load, as a missing local fallback does on Android', async () => {
		const fonts = {
			load: () => Promise.reject(new DOMException('A network error occurred.', 'NetworkError')),
		};
		await expect(loadFont(fonts, '10px "Geist Mono", "Geist Mono Fallback"')).resolves.toBeUndefined();
	});
});
