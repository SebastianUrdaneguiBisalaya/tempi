import { z } from 'zod';

/** The repository whose published GitHub Releases ship Tempi; electron-builder's `publish` points at the same one. */
export const RELEASES_REPO = 'SebastianUrdaneguiBisalaya/tempi';

/** The newest published release: its version (without the tag's `v`) and the page to download it from. */
export type LatestRelease = { url: string; version: string };

/** The subset of `fetch` the check uses, so tests can stand in for GitHub. */
export type ReleaseFetch = (url: string, init: { headers: Record<string, string> }) => Promise<{ json: () => Promise<unknown>; ok: boolean; status: number }>;

// Only what the check needs; GitHub's answer carries much more.
const releaseSchema = z.object({ html_url: z.url({ protocol: /^https$/ }), tag_name: z.string().min(1) });

/**
 * The latest published release of `repo`, or null when it has none yet. Drafts and prereleases aren't "latest", so a
 * draft under review is never offered.
 */
export const fetchLatestRelease = async (fetch: ReleaseFetch, repo = RELEASES_REPO): Promise<LatestRelease | null> => {
	const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`GitHub answered ${response.status} for the latest release`);
	const release = releaseSchema.parse(await response.json());
	return { url: release.html_url, version: release.tag_name.replace(/^v/, '') };
};
