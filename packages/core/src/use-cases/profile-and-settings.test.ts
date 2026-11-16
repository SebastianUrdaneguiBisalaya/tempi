import { describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { ProfileInput } from '../domain/user-profile';
import { getProfile } from './get-profile';
import { getSettings } from './get-settings';
import { initializeSettings } from './initialize-settings';
import { saveProfile } from './save-profile';
import { saveSettings } from './save-settings';
import { failure, makeDeps, T0 } from './test-fakes';
import { updateProfile } from './update-profile';

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
		await saveProfile(deps, { ...profileInput, avatar: 'me.png' });
		expect(await getProfile(deps)).toMatchObject({ avatar: 'me.png', createdAt: T0, updatedAt: '2026-11-20T00:00:00.000Z' });
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

describe('updateProfile', () => {
	const image = { bytes: new Uint8Array([1, 2, 3]), type: 'image/png' } as const;
	const fields = { country: 'PE', firstName: 'Ana', lastName: 'Quispe', timeZone: 'America/Lima' };

	test('stores a new avatar image and points the profile at it', async () => {
		const deps = makeDeps();
		await saveProfile(deps, { ...fields, avatar: 'old.png' });

		const result = await updateProfile(deps, { ...fields, avatar: image, firstName: 'Ana María' });
		expect(result).toMatchObject({ ok: true, value: { avatar: 'id-1.png', firstName: 'Ana María' } });
		expect(deps.avatars.files.get('id-1.png')).toEqual(image);
		expect(await getProfile(deps)).toMatchObject({ avatar: 'id-1.png', createdAt: T0 });
	});

	test('keeps the current avatar when none is sent, and removes it with null', async () => {
		const deps = makeDeps();
		await saveProfile(deps, { ...fields, avatar: 'me.png' });

		expect(await updateProfile(deps, { ...fields, lastName: 'Mamani' })).toMatchObject({ ok: true, value: { avatar: 'me.png', lastName: 'Mamani' } });
		expect(await updateProfile(deps, { ...fields, avatar: null })).toMatchObject({ ok: true, value: { avatar: null } });
		expect(deps.avatars.files.size).toBe(0);
	});

	test('reports every invalid field and stores nothing', async () => {
		const deps = makeDeps();
		await saveProfile(deps, { ...fields, avatar: null });

		const result = await updateProfile(deps, { ...fields, avatar: { bytes: new Uint8Array(), type: 'image/png' }, country: 'Peru', firstName: '' });
		expect(result).toEqual(failure('validation'));
		expect(!result.ok && result.error.issues.map(issue => issue.field).sort()).toEqual(['avatar.bytes', 'country', 'firstName']);
		expect(deps.avatars.files.size).toBe(0);
		expect(await getProfile(deps)).toMatchObject({ firstName: 'Ana' });
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

	test('first run persists the defaults with the system language', async () => {
		const deps = makeDeps();
		const result = await initializeSettings(deps, ['es-PE', 'en-US']);
		expect(result).toEqual({ ok: true, value: { ...DEFAULT_SETTINGS, createdAt: T0, language: 'es', updatedAt: T0 } });
		expect(deps.settings.value).toEqual({ ...DEFAULT_SETTINGS, createdAt: T0, language: 'es', updatedAt: T0 });
	});

	test('later runs keep the stored settings and ignore the system language', async () => {
		const deps = makeDeps();
		await saveSettings(deps, { language: 'en', theme: 'dark' });
		deps.clock.set('2026-11-20T00:00:00.000Z');
		const result = await initializeSettings(deps, ['es-PE']);
		expect(result).toEqual({ ok: true, value: { ...DEFAULT_SETTINGS, createdAt: T0, theme: 'dark', updatedAt: T0 } });
	});
});
