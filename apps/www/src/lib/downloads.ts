import type { Platform } from './platform';

type Download = {
	key: string;
	/** Architecture or package name, the same in every language. */
	label: string;
	url: string;
};

/**
 * Every installer the landing page links to, mirroring the files in MANUAL.md. URLs stay empty until the first
 * release is published. The first entry per platform is the default for the hero's "Download for {OS}" button.
 */
export const DOWNLOADS = {
	macos: [
		{ key: 'arm64', label: 'Apple Silicon', url: '' },
		{ key: 'x64', label: 'Intel', url: '' },
	],
	windows: [{ key: 'x64', label: 'x64', url: '' }],
	linux: [
		{ key: 'appimage', label: 'AppImage', url: '' },
		{ key: 'deb', label: '.deb', url: '' },
	],
} as const satisfies Record<Platform, readonly [Download, ...Download[]]>;

export const defaultDownloadUrl = (platform: Platform): string => DOWNLOADS[platform][0].url;
