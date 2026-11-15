import { describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { ProfileInput } from '../domain/user-profile';
import { getProfile } from './get-profile';
import { getSettings } from './get-settings';
import { saveProfile } from './save-profile';
import { saveSettings } from './save-settings';
import { failure, makeDeps, T0 } from './test-fakes';

const profileInput: ProfileInput = { avatar: null, country: 'pe', firstName: ' Ana ', lastName: 'Quispe', timeZone: 'America/Lima' };

describe('profile', () => {
	test('is null until saved', async () => {
		expect(await getProfile(makeDeps())).toBeNull();
	});

	test('saves a normalized profile and keeps createdAt on later saves', async () => {
		const deps = makeDeps();
		const first = await saveProfile(deps, profileInput);
		expect(first.ok && first.value).toEqual({ avatar: null, country: 'PE', createdAt: T0, firstName: 'Ana', lastName: 'Quispe', timeZone: 'America/Lima', updatedAt: T0 });

		deps.clock.set('2026-11-20T00:00:00.000Z');
		await saveProfile(deps, { ...profileInput, avatar: '/avatars/me.png' });
		expect(await getProfile(deps)).toMatchObject({ avatar: '/avatars/me.png', createdAt: T0, updatedAt: '2026-11-20T00:00:00.000Z' });
	});

	test.each([
		['firstName', { firstName: '' }],
		['lastName', { lastName: ' ' }],
		['country', { country: 'Peru' }],
		['timeZone', { timeZone: 'Lima' }],
	] as const)('rejects an invalid %s', async (field, override) => {
		const deps = makeDeps();
		const result = await saveProfile(deps, { ...profileInput, ...override });
		expect(result).toEqual(failure('validation', field));
		expect(await getProfile(deps)).toBeNull();
	});
});

describe('settings', () => {
	test('returns defaults before the first save without persisting them', async () => {
		const deps = makeDeps();
		expect(await getSettings(deps)).toEqual({ ...DEFAULT_SETTINGS, createdAt: T0, updatedAt: T0 });
		expect(deps.settings.value).toBeNull();
	});

	test('merges a patch over the stored settings', async () => {
		const deps = makeDeps();
		await saveSettings(deps, { language: 'es' });
		deps.clock.set('2026-11-20T00:00:00.000Z');
		await saveSettings(deps, { theme: 'dark' });

		expect(await getSettings(deps)).toEqual({ ...DEFAULT_SETTINGS, createdAt: T0, language: 'es', theme: 'dark', updatedAt: '2026-11-20T00:00:00.000Z' });
	});

	test.each([0, -15, 1.5, 1441])('rejects a default event duration of %p', async duration => {
		const deps = makeDeps();
		const result = await saveSettings(deps, { defaultEventDuration: duration });
		expect(result).toEqual(failure('validation', 'defaultEventDuration'));
	});
});
