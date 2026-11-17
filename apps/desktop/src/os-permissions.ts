import type { OsPermission, OsPermissionState, OsPermissionsStatus } from '@tempi/core';

/**
 * The OS privacy pages Tempi may open, one per permission and platform. Fixed here so the renderer only ever names a
 * permission and can't make the app open a URL of its choosing. Linux has no such per-app pages.
 */
const SYSTEM_SETTINGS_URLS: Partial<Record<NodeJS.Platform, Record<OsPermission, string>>> = {
	darwin: {
		microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
		notifications: 'x-apple.systempreferences:com.apple.preference.notifications',
	},
	win32: {
		microphone: 'ms-settings:privacy-microphone',
		notifications: 'ms-settings:notifications',
	},
};

export const systemSettingsUrl = (platform: NodeJS.Platform, permission: OsPermission): string | null => SYSTEM_SETTINGS_URLS[platform]?.[permission] ?? null;

/** The part of Electron's `systemPreferences` that reads the microphone's state (macOS and Windows only). */
export type MediaAccessStatus = { getMediaAccessStatus: (mediaType: 'microphone') => string };

const MICROPHONE_STATES: Record<string, OsPermissionState> = {
	denied: 'denied',
	granted: 'granted',
	'not-determined': 'not-determined',
	// Parental controls or a device policy: the user can't allow it either, so it reads as denied.
	restricted: 'denied',
};

/**
 * What the OS allows, read without prompting. Electron can't read whether notifications are allowed, so where the OS
 * shows them they are `unknown`; the microphone's state comes from macOS and Windows, while Linux has no per-app setting.
 */
export const osPermissionsStatus = (platform: NodeJS.Platform, preferences: MediaAccessStatus, notificationsSupported: boolean): OsPermissionsStatus => {
	const microphone: OsPermissionState = platform === 'darwin' || platform === 'win32' ? (MICROPHONE_STATES[preferences.getMediaAccessStatus('microphone')] ?? 'unknown') : 'unsupported';
	return {
		microphone: { canOpenSettings: systemSettingsUrl(platform, 'microphone') !== null, state: microphone },
		notifications: { canOpenSettings: notificationsSupported && systemSettingsUrl(platform, 'notifications') !== null, state: notificationsSupported ? 'unknown' : 'unsupported' },
	};
};
