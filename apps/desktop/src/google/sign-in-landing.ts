import type { Language } from '@tempi/core';

const SITE_URL = 'https://tempi.sebastianurdanegui.com';

/** The landing page that tells the user, in the app's language, how the Google sign-in ended. */
export const signInLandingUrl = (language: Language, succeeded: boolean): string => `${SITE_URL}/${language}/${succeeded ? 'signed-in' : 'sign-in-failed'}`;
