import { describe, expect, test } from 'bun:test';
import { osPermissionsStatus, systemSettingsUrl } from './os-permissions';

const microphone = (status: string) => {
	const asked: string[] = [];
	return {
		asked,
		preferences: {
			getMediaAccessStatus: (type: 'microphone') => {
				asked.push(type);
				return status;
			},
		},
	};
};

describe('osPermissionsStatus', () => {
	test.each([
		['granted', 'granted'],
		['denied', 'denied'],
		['restricted', 'denied'],
		['not-determined', 'not-determined'],
		['unknown', 'unknown'],
	] as const)('reads a %s microphone on macOS as %s', (status, state) => {
		expect(osPermissionsStatus('darwin', microphone(status).preferences, true).microphone).toEqual({ canOpenSettings: true, state });
	});

	test('reads the microphone on Windows too', () => {
		expect(osPermissionsStatus('win32', microphone('denied').preferences, true).microphone).toEqual({ canOpenSettings: true, state: 'denied' });
	});

	test('has no microphone setting to read or open on Linux', () => {
		const { asked, preferences } = microphone('granted');
		expect(osPermissionsStatus('linux', preferences, true).microphone).toEqual({ canOpenSettings: false, state: 'unsupported' });
		expect(asked).toEqual([]);
	});

	test('reports notifications as unknown where the OS shows them, unsupported otherwise', () => {
		expect(osPermissionsStatus('darwin', microphone('granted').preferences, true).notifications).toEqual({ canOpenSettings: true, state: 'unknown' });
		expect(osPermissionsStatus('linux', microphone('granted').preferences, true).notifications).toEqual({ canOpenSettings: false, state: 'unknown' });
		expect(osPermissionsStatus('darwin', microphone('granted').preferences, false).notifications).toEqual({ canOpenSettings: false, state: 'unsupported' });
	});
});

describe('systemSettingsUrl', () => {
	test('opens only the fixed privacy pages of macOS and Windows', () => {
		expect(systemSettingsUrl('darwin', 'microphone')).toBe('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
		expect(systemSettingsUrl('darwin', 'notifications')).toBe('x-apple.systempreferences:com.apple.preference.notifications');
		expect(systemSettingsUrl('win32', 'microphone')).toBe('ms-settings:privacy-microphone');
		expect(systemSettingsUrl('win32', 'notifications')).toBe('ms-settings:notifications');
		expect(systemSettingsUrl('linux', 'microphone')).toBeNull();
	});
});
