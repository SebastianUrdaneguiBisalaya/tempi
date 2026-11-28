import { describe, expect, test } from 'bun:test';
import { isTrackedPath, track } from './analytics';

describe('track', () => {
	test('pushes the event with its parameters and the page locale', () => {
		const entries: Record<string, unknown>[] = [];
		track('download_click', { platform: 'macos', variant: 'arm64', source: 'hero' }, { dataLayer: { push: entry => entries.push(entry) }, locale: 'es' });
		expect(entries).toEqual([{ event: 'download_click', locale: 'es', platform: 'macos', variant: 'arm64', source: 'hero' }]);
	});

	test('sends nothing before GTM has loaded', () => {
		expect(() => track('author_click', {}, { locale: 'en' })).not.toThrow();
	});
});

describe('isTrackedPath', () => {
	test('tracks the landing and legal pages', () => {
		expect(isTrackedPath('/en')).toBe(true);
		expect(isTrackedPath('/es/privacy')).toBe(true);
	});

	test('skips the Google sign-in return pages', () => {
		expect(isTrackedPath('/en/signed-in')).toBe(false);
		expect(isTrackedPath('/es/sign-in-failed/')).toBe(false);
	});
});
