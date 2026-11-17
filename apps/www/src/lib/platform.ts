export const PLATFORMS = ['macos', 'windows', 'linux'] as const;

export type Platform = (typeof PLATFORMS)[number];

// Product names, the same in every language.
export const PLATFORM_NAMES: Record<Platform, string> = {
	macos: 'macOS',
	windows: 'Windows',
	linux: 'Linux',
};

/** The desktop platform of a user agent, or `null` for phones, tablets and anything Tempi doesn't ship for. */
export function detectPlatform(userAgent: string): Platform | null {
	if (/iPhone|iPad|iPod|Android/i.test(userAgent)) return null;
	if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macos';
	if (/Windows/i.test(userAgent)) return 'windows';
	if (/Linux|X11|CrOS/i.test(userAgent)) return 'linux';
	return null;
}
