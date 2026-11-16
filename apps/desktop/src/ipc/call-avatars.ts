import type { AvatarStore } from '@tempi/core';
import type { CommitHooks } from './handle';

/**
 * The avatar store as one IPC call sees it: an image the call writes is deleted again if its transaction rolls back,
 * so a failed onboarding or profile update leaves no file that nothing references.
 */
export const callAvatars = (avatars: AvatarStore, { afterRollback }: Pick<CommitHooks, 'afterRollback'>): AvatarStore => ({
	remove: fileName => avatars.remove(fileName),
	save: async (fileName, image) => {
		afterRollback(() => avatars.remove(fileName));
		await avatars.save(fileName, image);
	},
});
