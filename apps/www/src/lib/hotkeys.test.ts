import { describe, expect, test } from 'bun:test';
import { formatHotkey } from './hotkeys';

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

describe('formatHotkey', () => {
	test('writes mod as ⌘ on macOS and Ctrl elsewhere', () => {
		expect(formatHotkey('mod+k', MAC)).toBe('⌘K');
		expect(formatHotkey('mod+k', WINDOWS)).toBe('Ctrl+K');
	});

	test('uppercases letters and names arrows', () => {
		expect(formatHotkey('t', WINDOWS)).toBe('T');
		expect(formatHotkey('arrowright', MAC)).toBe('→');
	});

	test('keeps symbols as they are', () => {
		expect(formatHotkey('?', MAC)).toBe('?');
		expect(formatHotkey('mod+,', MAC)).toBe('⌘,');
	});
});
