import type { UserProfile } from '../domain/user-profile';

export type ProfileRepository = {
	/** Null until the user completes their profile. */
	get(): Promise<UserProfile | null>;
	save(profile: UserProfile): Promise<void>;
};
