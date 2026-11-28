import type { Platform } from './platform';
import { GITHUB_URL } from './site';

type Download = {
	key: string;
	/** Architecture or package name, the same in every language. */
	label: string;
	url: string;
};

// GitHub redirects `releases/latest/download/<file>` to that file in the newest published release, and installers
// carry no version in their names (`artifactName` in apps/desktop), so these links never need a redeploy.
const latest = (file: string): string => `${GITHUB_URL}/releases/latest/download/${file}`;

/**
 * Every installer the landing page links to, mirroring the files in MANUAL.md. The first entry per platform is the
 * default for the hero's "Download for {OS}" button.
 */
export const DOWNLOADS = {
	macos: [
		{ key: 'arm64', label: 'Apple Silicon', url: latest('Tempi-mac-arm64.dmg') },
		{ key: 'x64', label: 'Intel', url: latest('Tempi-mac-x64.dmg') },
	],
	windows: [{ key: 'x64', label: 'x64', url: latest('Tempi-win-x64.exe') }],
	linux: [
		{ key: 'appimage', label: 'AppImage', url: latest('Tempi-linux-x86_64.AppImage') },
		{ key: 'deb', label: '.deb', url: latest('Tempi-linux-amd64.deb') },
	],
} as const satisfies Record<Platform, readonly [Download, ...Download[]]>;
