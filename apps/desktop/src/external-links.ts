import { z } from 'zod';

// Only links meant for a browser or a mail client leave the app. Anything else (`file:`, `javascript:`, schemes
// registered by other apps) could run local programs through the OS, so it is dropped.
const externalUrlSchema = z.url({ protocol: /^(https?|mailto)$/ });

/** True when `url` may be handed to `shell.openExternal`. */
export const isAllowedExternalUrl = (url: string): boolean => externalUrlSchema.safeParse(url).success;

/** Opens an allowed URL with `open` (`shell.openExternal`), or logs and ignores any other. Returns whether it opened. */
export const openExternalUrl = (url: string, open: (url: string) => Promise<void>): boolean => {
	if (!isAllowedExternalUrl(url)) {
		console.warn(`Blocked opening ${url}: only http(s) and mailto links open outside the app`);
		return false;
	}
	open(url).catch((error: unknown) => console.error(`Could not open ${url}:`, error));
	return true;
};
