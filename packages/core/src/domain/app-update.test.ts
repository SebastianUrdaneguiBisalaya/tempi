import { describe, expect, test } from 'bun:test';
import { compareVersions, isNewerVersion } from './app-update';

describe('compareVersions', () => {
	test('orders by major, minor, then patch', () => {
		expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
		expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
		expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
		expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
	});

	test('accepts the v prefix of release tags', () => {
		expect(compareVersions('v0.2.0', '0.1.0')).toBe(1);
		expect(compareVersions('v1.0.0', 'v1.0.0')).toBe(0);
	});

	test('ranks a prerelease before its release', () => {
		expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
		expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
	});

	test('orders prerelease identifiers numerically, then by length', () => {
		expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
		expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
		expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
		expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
	});

	test('ignores build metadata', () => {
		expect(compareVersions('1.0.0+build.5', '1.0.0')).toBe(0);
	});

	test('returns null for anything that is not a version', () => {
		expect(compareVersions('latest', '1.0.0')).toBeNull();
		expect(compareVersions('1.0', '1.0.0')).toBeNull();
	});
});

describe('isNewerVersion', () => {
	test('is true only for a strictly newer valid version', () => {
		expect(isNewerVersion('v0.2.0', '0.1.0')).toBe(true);
		expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
		expect(isNewerVersion('0.0.9', '0.1.0')).toBe(false);
		expect(isNewerVersion('nightly', '0.1.0')).toBe(false);
	});
});
