import { z } from 'zod';
import { optionalTextSchema, requiredTextSchema, timeZoneSchema } from './values';

export const profileInputSchema = z.object({
	/** Local file path of the avatar image, or null. */
	avatar: optionalTextSchema,
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
export type UserProfile = z.output<typeof profileInputSchema> & {
	createdAt: string;
	updatedAt: string;
};
