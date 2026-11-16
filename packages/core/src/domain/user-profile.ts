import { z } from 'zod';
import { avatarFileNameSchema } from './avatar';
import { singletonTimestampsSchema } from './timestamps';
import { requiredTextSchema, timeZoneSchema } from './values';

export const profileInputSchema = z.object({
	/** File name of the stored avatar image (resolved by the avatar store), or null for the initials. */
	avatar: avatarFileNameSchema.nullish().transform(value => value ?? null),
	/** ISO 3166-1 alpha-2 code, stored uppercase. */
	country: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{2}$/, 'profile.country'),
	firstName: requiredTextSchema,
	lastName: requiredTextSchema,
	timeZone: timeZoneSchema,
});

export type ProfileInput = z.input<typeof profileInputSchema>;

/** The single local user. There is one profile per installation, so it has no id. */
export const userProfileSchema = profileInputSchema.extend(singletonTimestampsSchema.shape);

export type UserProfile = z.output<typeof userProfileSchema>;
