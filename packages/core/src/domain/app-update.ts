import { z } from 'zod';
import { utcInstantSchema } from './values';

/** `major.minor.patch`, an optional leading `v` (release tags) and an optional `-prerelease`; build metadata is ignored. */
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

type ParsedVersion = { core: [number, number, number]; prerelease: string[] };

const parseVersion = (version: string): ParsedVersion | null => {
	const match = VERSION_PATTERN.exec(version.trim());
	if (match === null) return null;
	const [, major = '0', minor = '0', patch = '0', prerelease] = match;
	return { core: [Number(major), Number(minor), Number(patch)], prerelease: prerelease === undefined ? [] : prerelease.split('.') };
};

const comparePrereleaseId = (a: string, b: string): number => {
	const numeric = /^\d+$/;
	if (numeric.test(a) && numeric.test(b)) return Math.sign(Number(a) - Number(b));
	// Numeric identifiers sort before alphanumeric ones (SemVer 11.4.3).
	if (numeric.test(a)) return -1;
	if (numeric.test(b)) return 1;
	return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * Orders two versions by SemVer precedence: negative when `a` is older, positive when newer, 0 when equal. A prerelease
 * is older than its release (`1.0.0-beta.1` < `1.0.0`). Null when either isn't a version.
 */
export const compareVersions = (a: string, b: string): number | null => {
	const left = parseVersion(a);
	const right = parseVersion(b);
	if (left === null || right === null) return null;
	for (let index = 0; index < 3; index++) {
		const difference = (left.core[index] ?? 0) - (right.core[index] ?? 0);
		if (difference !== 0) return Math.sign(difference);
	}
	if (left.prerelease.length === 0 || right.prerelease.length === 0) return Math.sign(right.prerelease.length - left.prerelease.length);
	for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index++) {
		const [x, y] = [left.prerelease[index], right.prerelease[index]];
		// A shorter list of identifiers is older when the rest are equal.
		if (x === undefined) return -1;
		if (y === undefined) return 1;
		const order = comparePrereleaseId(x, y);
		if (order !== 0) return order;
	}
	return 0;
};

/** True only when `candidate` is a valid version strictly newer than `current`. */
export const isNewerVersion = (candidate: string, current: string): boolean => (compareVersions(candidate, current) ?? 0) > 0;

/**
 * Where the app's update stands. Windows and the Linux AppImage download in the background (`downloading`, then
 * `ready` to install on restart); macOS and other Linux packages can only be told a newer release exists (`available`,
 * with its page). `unsupported` is a build that can't update, such as a development run.
 */
export const APP_UPDATE_STATES = ['idle', 'checking', 'upToDate', 'downloading', 'ready', 'available', 'error', 'unsupported'] as const;

export type AppUpdateState = (typeof APP_UPDATE_STATES)[number];

export const appUpdateStatusSchema = z.object({
	/** When the last check finished, successfully or not. */
	checkedAt: utcInstantSchema.nullable(),
	currentVersion: z.string().min(1),
	/** The release page to download a newer version by hand; only with `available`. */
	downloadUrl: z.url({ protocol: /^https$/ }).nullable(),
	/** The newer version found; null while none is known. */
	latestVersion: z.string().min(1).nullable(),
	state: z.enum(APP_UPDATE_STATES),
});

export type AppUpdateStatus = z.output<typeof appUpdateStatusSchema>;
