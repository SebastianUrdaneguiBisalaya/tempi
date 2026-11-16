import { describe, expect, test } from 'bun:test';
import { resolveLanguage } from './settings';

describe('resolveLanguage', () => {
	test.each([
		[['es-PE', 'en-US'], 'es'],
		[['ES_es'], 'es'],
		[['fr-FR', 'en-GB', 'es'], 'en'],
		[['pt-BR', 'fr'], 'en'],
		[[], 'en'],
	] as const)('picks the first supported language of %p', (locales, expected) => {
		expect(resolveLanguage(locales)).toBe(expected);
	});
});
