import { type AvatarImage, avatarFileName } from '../domain/avatar';
import type { CoreDeps } from './deps';

/**
 * Stores an avatar image under a new file name and returns it. Call it before the database write: if that fails, the
 * transaction rolls back and only an unreferenced file remains.
 */
export const storeAvatar = async (deps: Pick<CoreDeps, 'avatars' | 'ids'>, image: AvatarImage): Promise<string> => {
	const fileName = avatarFileName(deps.ids.next(), image.type);
	await deps.avatars.save(fileName, image);
	return fileName;
};
