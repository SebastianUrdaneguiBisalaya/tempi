import { type FuseConfig, FuseV1Options } from '@electron/fuses';

// A fuse's state in the binary is an ASCII digit; `@electron/fuses` doesn't export its names for them.
export const FUSE_DISABLED = '0'.charCodeAt(0);
export const FUSE_ENABLED = '1'.charCodeAt(0);

/**
 * Fuses a release build must have, mirrored from `build.electronFuses` in package.json: no running the binary as
 * plain Node, no `NODE_OPTIONS`, and app code only from the packaged asar.
 */
export const EXPECTED_FUSES = [
	{ enabled: false, fuse: FuseV1Options.RunAsNode, name: 'RunAsNode' },
	{ enabled: false, fuse: FuseV1Options.EnableNodeOptionsEnvironmentVariable, name: 'EnableNodeOptionsEnvironmentVariable' },
	{ enabled: true, fuse: FuseV1Options.OnlyLoadAppFromAsar, name: 'OnlyLoadAppFromAsar' },
] as const;

/** Every expected fuse the wire doesn't match, as readable lines; empty when the build is locked down. */
export const fuseProblems = (wire: FuseConfig<number>): string[] =>
	EXPECTED_FUSES.flatMap(({ enabled, fuse, name }) => {
		const state = wire[fuse];
		const want = enabled ? FUSE_ENABLED : FUSE_DISABLED;
		return state === want ? [] : [`${name} should be ${enabled ? 'enabled' : 'disabled'} (state ${String(state)})`];
	});
