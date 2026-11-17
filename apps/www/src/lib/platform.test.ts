import { describe, expect, test } from 'bun:test';
import { detectPlatform } from './platform';

describe('detectPlatform', () => {
	test('detects macOS', () => {
		expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBe('macos');
	});

	test('detects Windows', () => {
		expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36')).toBe('windows');
	});

	test('detects Linux', () => {
		expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0')).toBe('linux');
	});

	test('returns null for phones and tablets', () => {
		expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')).toBeNull();
		expect(detectPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36')).toBeNull();
	});

	test('returns null for unknown agents', () => {
		expect(detectPlatform('curl/8.7.1')).toBeNull();
	});
});
