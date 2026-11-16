import type { AvatarImage } from '../domain/avatar';

/** Where avatar images live, outside the database (e.g. a folder in the app's user data). */
export type AvatarStore = {
	/** Writes the image under `fileName`, replacing any file with that name. */
	save(fileName: string, image: AvatarImage): Promise<void>;
	/** Deletes the image stored under `fileName`; a file that is already gone is not an error. */
	remove(fileName: string): Promise<void>;
};
