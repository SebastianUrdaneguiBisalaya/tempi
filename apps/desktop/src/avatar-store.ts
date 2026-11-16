import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type AvatarStore, avatarFileNameSchema } from '@tempi/core';

/**
 * Where a stored avatar lives inside `dir`, or null when `fileName` isn't a valid avatar file name.
 * The name schema allows no slashes or `..`, so the result can never point outside `dir`.
 */
export const avatarPath = (dir: string, fileName: string): string | null => (avatarFileNameSchema.safeParse(fileName).success ? path.join(dir, fileName) : null);

/** Keeps avatar images as files in `dir` (the app's `userData/avatars`). */
export const createFileAvatarStore = (dir: string): AvatarStore => ({
	save: async (fileName, image) => {
		const target = avatarPath(dir, fileName);
		if (target === null) throw new Error(`Refused to store an avatar as "${fileName}"`);
		await mkdir(dir, { recursive: true });
		await writeFile(target, image.bytes);
	},
});
