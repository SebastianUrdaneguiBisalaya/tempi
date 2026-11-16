import { describe, expect, mock, test } from 'bun:test';
import { isAllowedExternalUrl, openExternalUrl } from './external-links';

describe('isAllowedExternalUrl', () => {
	test.each(['https://meet.example/abc', 'http://example.com/path?q=1', 'HTTPS://EXAMPLE.COM', 'mailto:someone@example.com'])('allows %s', url => {
		expect(isAllowedExternalUrl(url)).toBe(true);
	});

	test.each(['file:///etc/passwd', 'javascript:alert(1)', 'zoommtg://zoom.us/join?confno=1', 'smb://server/share', 'ms-settings:', 'data:text/html,hi', 'not a url', ''])('blocks %s', url => {
		expect(isAllowedExternalUrl(url)).toBe(false);
	});
});

describe('openExternalUrl', () => {
	test('opens allowed links and ignores the rest', () => {
		const open = mock((_url: string) => Promise.resolve());
		const warn = mock((_message: string) => undefined);
		const original = console.warn;
		console.warn = warn;
		try {
			expect(openExternalUrl('https://meet.example/abc', open)).toBe(true);
			expect(openExternalUrl('file:///Applications/Calculator.app', open)).toBe(false);
		} finally {
			console.warn = original;
		}
		expect(open.mock.calls).toEqual([['https://meet.example/abc']]);
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
