/**
 * The desktop app serves stored avatars, read-only, from `tempi-avatar://local/<file name>`. A separate scheme keeps
 * user files out of the web export's `app://` origin and works with the dev server too.
 */
export const AVATAR_SCHEME = 'tempi-avatar';
export const AVATAR_HOST = 'local';

/** URL of a stored avatar, from the file name kept in the profile. */
export const avatarUrl = (fileName: string): string => `${AVATAR_SCHEME}://${AVATAR_HOST}/${encodeURIComponent(fileName)}`;
