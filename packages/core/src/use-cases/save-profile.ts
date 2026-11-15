import { ok, type Result } from '../domain/result';
import { type ProfileInput, type UserProfile, validateProfileInput } from '../domain/user-profile';
import { type CoreDeps, nowIso } from './deps';

/** Creates the profile on first save and replaces its fields afterwards, keeping `createdAt`. */
export const saveProfile = async (deps: Pick<CoreDeps, 'clock' | 'profile'>, input: ProfileInput): Promise<Result<UserProfile>> => {
	const fields = validateProfileInput(input);
	if (!fields.ok) return fields;

	const current = await deps.profile.get();
	const now = nowIso(deps.clock);
	const profile: UserProfile = { ...fields.value, createdAt: current?.createdAt ?? now, updatedAt: now };
	await deps.profile.save(profile);
	return ok(profile);
};
