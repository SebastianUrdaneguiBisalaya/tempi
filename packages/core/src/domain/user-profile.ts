import { fail, ok, type Result } from './result';
import { isValidTimeZone, optionalText } from './values';

/** The single local user. There is one profile per installation, so it has no id. */
export type UserProfile = {
	/** Local file path of the avatar image, or null. */
	avatar: string | null;
	/** ISO 3166-1 alpha-2 code, uppercase. */
	country: string;
	createdAt: string;
	firstName: string;
	lastName: string;
	timeZone: string;
	updatedAt: string;
};

export type ProfileInput = Pick<UserProfile, 'avatar' | 'country' | 'firstName' | 'lastName' | 'timeZone'>;

const COUNTRY_CODE = /^[A-Z]{2}$/;

export const validateProfileInput = (input: ProfileInput): Result<ProfileInput> => {
	const firstName = input.firstName.trim();
	if (firstName === '') return fail('validation', 'First name is required', 'firstName');
	const lastName = input.lastName.trim();
	if (lastName === '') return fail('validation', 'Last name is required', 'lastName');
	const country = input.country.trim().toUpperCase();
	if (!COUNTRY_CODE.test(country)) return fail('validation', 'Country must be an ISO 3166-1 alpha-2 code', 'country');
	if (!isValidTimeZone(input.timeZone)) return fail('validation', 'Time zone must be a valid IANA zone', 'timeZone');
	return ok({ avatar: optionalText(input.avatar), country, firstName, lastName, timeZone: input.timeZone });
};
