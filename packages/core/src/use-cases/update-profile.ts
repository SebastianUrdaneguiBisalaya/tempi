import { ok, parseWith, type Result } from '../domain/result';
import { type ProfileUpdateInput, profileUpdateInputSchema, type UserProfile } from '../domain/user-profile';
import type { CoreDeps } from './deps';
import { saveProfile } from './save-profile';
import { storeAvatar } from './store-avatar';

/** Saves the profile edited in settings: stores a new avatar image, removes the avatar, or keeps the current one. */
export const updateProfile = async (deps: Pick<CoreDeps, 'avatars' | 'clock' | 'ids' | 'profile'>, input: ProfileUpdateInput): Promise<Result<UserProfile>> => {
	const parsed = parseWith(profileUpdateInputSchema, input);
	if (!parsed.ok) return parsed;
	const { avatar: image, ...fields } = parsed.value;

	// The replaced image file stays on disk; nothing references it any more.
	const avatar = image === undefined ? ((await deps.profile.get())?.avatar ?? null) : image === null ? null : await storeAvatar(deps, image);
	return saveProfile(deps, { ...fields, avatar });
};
