import { z } from 'zod';
import { avatarImageSchema } from './avatar';
import { settingsValuesSchema } from './settings';
import { profileInputSchema } from './user-profile';

/**
 * Everything the first-run onboarding collects. Fields stay flat (no `profile.` prefix) so issues keep the paths the form uses.
 * The avatar arrives as image bytes, not a file name: the use case stores it and names the file.
 */
export const onboardingInputSchema = profileInputSchema.omit({ avatar: true }).extend({
	avatar: avatarImageSchema.nullable(),
	language: settingsValuesSchema.shape.language,
	theme: settingsValuesSchema.shape.theme,
});

export type OnboardingInput = z.input<typeof onboardingInputSchema>;
