import { avatarFileName } from '../domain/avatar';
import { type OnboardingInput, onboardingInputSchema } from '../domain/onboarding';
import { ok, parseWith, type Result } from '../domain/result';
import type { Settings } from '../domain/settings';
import type { UserProfile } from '../domain/user-profile';
import type { CoreDeps } from './deps';
import { saveProfile } from './save-profile';
import { saveSettings } from './save-settings';

export type OnboardingResult = { profile: UserProfile; settings: Settings };

/** Saves the profile (storing the avatar image, if any) and the chosen preferences, and marks onboarding as completed. */
export const completeOnboarding = async (deps: Pick<CoreDeps, 'avatars' | 'clock' | 'ids' | 'profile' | 'settings'>, input: OnboardingInput): Promise<Result<OnboardingResult>> => {
	const parsed = parseWith(onboardingInputSchema, input);
	if (!parsed.ok) return parsed;
	const { avatar: image, language, theme, ...fields } = parsed.value;

	// Written before the database: if a later step fails, the transaction rolls back and only an unreferenced file remains.
	let avatar: string | null = null;
	if (image !== null) {
		avatar = avatarFileName(deps.ids.next(), image.type);
		await deps.avatars.save(avatar, image);
	}

	const profile = await saveProfile(deps, { ...fields, avatar });
	if (!profile.ok) return profile;
	const settings = await saveSettings(deps, { language, onboardingCompleted: true, theme });
	if (!settings.ok) return settings;
	return ok({ profile: profile.value, settings: settings.value });
};
