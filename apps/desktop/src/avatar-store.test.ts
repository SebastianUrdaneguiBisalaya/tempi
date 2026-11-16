import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { avatarPath, createFileAvatarStore } from './avatar-store';

let root: string;

beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), 'tempi-avatars-'));
});

afterEach(() => rm(root, { force: true, recursive: true }));

describe('createFileAvatarStore', () => {
	test('creates the folder and writes the image bytes under the file name', async () => {
		const dir = path.join(root, 'avatars');
		await createFileAvatarStore(dir).save('id-1.webp', { bytes: new Uint8Array([1, 2, 3]), type: 'image/webp' });
		expect([...(await readFile(path.join(dir, 'id-1.webp')))]).toEqual([1, 2, 3]);
	});

	test('removes a stored image, and a missing one is not an error', async () => {
		const store = createFileAvatarStore(root);
		await store.save('id-1.png', { bytes: new Uint8Array([1]), type: 'image/png' });
		await store.remove('id-1.png');
		await expect(access(path.join(root, 'id-1.png'))).rejects.toThrow();
		await store.remove('id-1.png');
	});

	test('refuses to remove a file outside the folder', async () => {
		await writeFile(path.join(root, 'tempi.db'), 'data');
		await expect(createFileAvatarStore(path.join(root, 'avatars')).remove('../tempi.db')).rejects.toThrow('Refused');
		expect(await readFile(path.join(root, 'tempi.db'), 'utf8')).toBe('data');
	});

	test('refuses a file name that could leave the folder', async () => {
		const save = createFileAvatarStore(root).save('../escape.png', { bytes: new Uint8Array([1]), type: 'image/png' });
		await expect(save).rejects.toThrow('Refused');
	});
});

describe('avatarPath', () => {
	test.each(['id-1.webp', '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.png'])('resolves %s inside the folder', fileName => {
		expect(avatarPath(root, fileName)).toBe(path.join(root, fileName));
	});

	test.each(['../tempi.db', 'a/b.png', '..%2Fx.png', 'photo.gif', 'tempi.db', ''])('rejects %p', fileName => {
		expect(avatarPath(root, fileName)).toBeNull();
	});
});
