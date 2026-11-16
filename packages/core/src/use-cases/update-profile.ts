import { ok, parseWith, type Result } from '../domain/result';
import { type ProfileUpdateInput, profileUpdateInputSchema, type UserProfile } from '../domain/user-profile';
import type { CoreDeps } from './deps';
import { saveProfile } from './save-profile';
import { storeAvatar } from './store-avatar';

export type ProfileUpdate = {
	profile: UserProfile;
	/**
	 * The avatar file the profile no longer references (replaced or removed), or null. The caller deletes it once the
	 * update is committed, never before: a rolled-back update still points at it.
	 */
	replacedAvatar: string | null;
};

/** Saves the profile edited in settings: stores a new avatar image, removes the avatar, or keeps the current one. */
export const updateProfile = async (deps: Pick<CoreDeps, 'avatars' | 'clock' | 'ids' | 'profile'>, input: ProfileUpdateInput): Promise<Result<ProfileUpdate>> => {
	const parsed = parseWith(profileUpdateInputSchema, input);
	if (!parsed.ok) return parsed;
	const { avatar: image, ...fields } = parsed.value;

	const current = (await deps.profile.get())?.avatar ?? null;
	const avatar = image === undefined ? current : image === null ? null : await storeAvatar(deps, image);
	const saved = await saveProfile(deps, { ...fields, avatar });
	if (!saved.ok) return saved;
	return ok({ profile: saved.value, replacedAvatar: current !== null && current !== avatar ? current : null });
};
