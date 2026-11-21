import { describe, expect, test } from 'bun:test';
import { hasScopes, missingScopes } from './scopes';

const required = ['https://example.com/a', 'https://example.com/b'];

describe('scope checks', () => {
	test('a space-separated grant covers the scopes it lists', () => {
		expect(hasScopes('openid https://example.com/b https://example.com/a', required)).toBe(true);
		expect(hasScopes(['https://example.com/a', 'https://example.com/b'], required)).toBe(true);
	});

	test('names what the grant lacks, in the order required', () => {
		expect(missingScopes('openid https://example.com/b', required)).toEqual(['https://example.com/a']);
		expect(missingScopes('', required)).toEqual(required);
		expect(hasScopes('openid email', required)).toBe(false);
	});

	test('requiring nothing is always covered', () => {
		expect(hasScopes('', [])).toBe(true);
	});
});
