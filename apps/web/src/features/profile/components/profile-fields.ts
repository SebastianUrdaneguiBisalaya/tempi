import type { AvatarImage } from '@tempi/core';

/**
 * The profile fields the onboarding and the settings forms share. The avatar is a new image, `null` for none, or
 * (in settings only) left undefined to keep the stored one.
 */
export type ProfileFormFields = {
	avatar?: AvatarImage | null;
	country: string;
	firstName: string;
	lastName: string;
	timeZone: string;
};
