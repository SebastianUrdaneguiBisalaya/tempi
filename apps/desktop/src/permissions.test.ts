import { describe, expect, test } from 'bun:test';
import { createPermissionRequestHandler, isPermissionCheckAllowed, microphoneAccess } from './permissions';

const APP = 'app://tempi';
const isTrusted = (url: string) => url === APP || url.startsWith(`${APP}/`);

const handler = (granted = true) => {
	let asked = 0;
	const request = createPermissionRequestHandler({
		isTrusted,
		microphoneAccess: () => {
			asked++;
			return Promise.resolve(granted);
		},
	});
	return { asked: () => asked, request };
};

describe('permission requests', () => {
	test('allow audio capture from the app', async () => {
		const { asked, request } = handler();
		expect(await request({ mediaTypes: ['audio'], permission: 'media', requestingUrl: `${APP}/` })).toBe(true);
		expect(asked()).toBe(1);
	});

	test.each([
		['video', { mediaTypes: ['video'], permission: 'media', requestingUrl: `${APP}/` }],
		['audio with video', { mediaTypes: ['audio', 'video'], permission: 'media', requestingUrl: `${APP}/` }],
		['media without types', { permission: 'media', requestingUrl: `${APP}/` }],
		['audio from another origin', { mediaTypes: ['audio'], permission: 'media', requestingUrl: 'https://evil.example/' }],
		['a look-alike origin', { mediaTypes: ['audio'], permission: 'media', requestingUrl: 'app://tempi.evil/' }],
		['notifications', { permission: 'notifications', requestingUrl: `${APP}/` }],
		['geolocation', { permission: 'geolocation', requestingUrl: `${APP}/` }],
		['clipboard reads', { permission: 'clipboard-read', requestingUrl: `${APP}/` }],
	])('deny %s, without asking the OS', async (_name, ask) => {
		const { asked, request } = handler();
		expect(await request(ask)).toBe(false);
		expect(asked()).toBe(0);
	});

	test('deny audio when the OS refuses the microphone, or asking fails', async () => {
		expect(await handler(false).request({ mediaTypes: ['audio'], permission: 'media', requestingUrl: `${APP}/` })).toBe(false);
		const failing = createPermissionRequestHandler({ isTrusted, microphoneAccess: () => Promise.reject(new Error('no prompt')) });
		expect(await failing({ mediaTypes: ['audio'], permission: 'media', requestingUrl: `${APP}/` })).toBe(false);
	});
});

describe('permission checks', () => {
	test('allow only audio for the app’s origin', () => {
		expect(isPermissionCheckAllowed({ mediaType: 'audio', permission: 'media', requestingOrigin: APP }, isTrusted)).toBe(true);
		expect(isPermissionCheckAllowed({ mediaType: 'video', permission: 'media', requestingOrigin: APP }, isTrusted)).toBe(false);
		expect(isPermissionCheckAllowed({ mediaType: 'audio', permission: 'media', requestingOrigin: 'https://evil.example' }, isTrusted)).toBe(false);
		expect(isPermissionCheckAllowed({ permission: 'notifications', requestingOrigin: APP }, isTrusted)).toBe(false);
	});
});

describe('macOS microphone access', () => {
	const preferences = (status: string, answer = true) => {
		const asked: string[] = [];
		return {
			asked,
			preferences: {
				askForMediaAccess: (type: 'microphone') => {
					asked.push(type);
					return Promise.resolve(answer);
				},
				getMediaAccessStatus: () => status,
			},
		};
	};

	test('asks the user only the first time, then respects the answer', async () => {
		const first = preferences('not-determined', true);
		expect(await microphoneAccess('darwin', first.preferences)()).toBe(true);
		expect(first.asked).toEqual(['microphone']);

		const granted = preferences('granted');
		expect(await microphoneAccess('darwin', granted.preferences)()).toBe(true);
		expect(granted.asked).toEqual([]);

		for (const status of ['denied', 'restricted']) {
			const refused = preferences(status);
			expect(await microphoneAccess('darwin', refused.preferences)()).toBe(false);
			expect(refused.asked).toEqual([]);
		}
	});

	test('has nothing to ask on Windows and Linux', async () => {
		for (const platform of ['win32', 'linux'] as const) expect(await microphoneAccess(platform, preferences('denied').preferences)()).toBe(true);
	});
});
