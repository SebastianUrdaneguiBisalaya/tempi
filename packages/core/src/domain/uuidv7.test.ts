import { describe, expect, test } from 'bun:test';
import { uuidv7 } from './uuidv7';

describe('uuidv7', () => {
	test('is a version 7, RFC 9562 variant UUID', () => {
		expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	test('encodes the timestamp so ids sort by creation time', () => {
		const earlier = uuidv7(Date.parse('2026-11-15T10:00:00.000Z'));
		const later = uuidv7(Date.parse('2026-11-15T10:00:00.001Z'));
		expect(earlier < later).toBe(true);
		expect(Number.parseInt(earlier.replace('-', '').slice(0, 12), 16)).toBe(Date.parse('2026-11-15T10:00:00.000Z'));
	});
});
