import { describe, expect, test } from 'bun:test';
import { MAX_AVATAR_BYTES } from '../domain/avatar';
import type { OnboardingInput } from '../domain/onboarding';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import type { UserProfile } from '../domain/user-profile';
import { completeOnboarding } from './complete-onboarding';
import { failure, makeDeps, T0 } from './test-fakes';

const input: OnboardingInput = { avatar: null, country: 'pe', firstName: ' Ana ', language: 'es', lastName: 'Quispe', theme: 'dark', timeZone: 'America/Lima' };

const image = { bytes: new Uint8Array([1, 2, 3]), type: 'image/webp' } as const;

describe('completeOnboarding', () => {
	test('saves the profile and preferences and marks onboarding as completed', async () => {
		const deps = makeDeps();
		const result = await completeOnboarding(deps, input);

		const profile: UserProfile = { avatar: null, country: 'PE', createdAt: T0, firstName: 'Ana', lastName: 'Quispe', timeZone: 'America/Lima', updatedAt: T0 };
		const settings: Settings = { ...DEFAULT_SETTINGS, createdAt: T0, language: 'es', onboardingCompleted: true, theme: 'dark', updatedAt: T0 };
		expect(result).toEqual({ ok: true, value: { profile, settings } });
		expect(deps.profile.value).toEqual(profile);
		expect(deps.settings.value).toEqual(settings);
		expect(deps.avatars.files.size).toBe(0);
	});

	test('stores the avatar image and references it by file name', async () => {
		const deps = makeDeps();
		const result = await completeOnboarding(deps, { ...input, avatar: image });

		expect(result.ok && result.value.profile.avatar).toBe('id-1.webp');
		expect(deps.avatars.files.get('id-1.webp')).toEqual(image);
	});

	test('rejects every invalid field at once, saving nothing', async () => {
		const deps = makeDeps();
		const result = await completeOnboarding(deps, {
			...input,
			avatar: { bytes: new Uint8Array(MAX_AVATAR_BYTES + 1), type: 'image/webp' },
			firstName: ' ',
			theme: 'neon' as 'dark',
			timeZone: 'Lima',
		});

		expect(result).toEqual(failure('validation'));
		const fields = result.ok ? [] : result.error.issues.map(issue => issue.field).sort();
		expect(fields).toEqual(['avatar.bytes', 'firstName', 'theme', 'timeZone']);
		expect(deps.avatars.files.size).toBe(0);
		expect(deps.profile.value).toBeNull();
		expect(deps.settings.value).toBeNull();
	});

	test.each([
		['an unsupported format', { bytes: new Uint8Array([1]), type: 'image/gif' }],
		['an empty image', { bytes: new Uint8Array(), type: 'image/png' }],
		['bytes that are not binary data', { bytes: [1, 2, 3], type: 'image/png' }],
	])('rejects %s as avatar', async (_, avatar) => {
		// The payload comes from outside (IPC), so it is checked at runtime whatever its static type.
		const result = await completeOnboarding(makeDeps(), { ...input, avatar } as unknown as OnboardingInput);
		expect(result.ok ? [] : result.error.issues.map(issue => issue.field?.split('.')[0])).toEqual(['avatar']);
	});
});
