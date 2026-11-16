import { describe, expect, test } from 'bun:test';
import { type FuseConfig, FuseV1Options, FuseVersion } from '@electron/fuses';
import { FUSE_DISABLED, FUSE_ENABLED, fuseProblems } from './release-fuses';

const lockedDown = { [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: FUSE_DISABLED, [FuseV1Options.OnlyLoadAppFromAsar]: FUSE_ENABLED, [FuseV1Options.RunAsNode]: FUSE_DISABLED };
const wire = (fuses: Partial<Record<FuseV1Options, number>>): FuseConfig<number> => ({ version: FuseVersion.V1, ...fuses });

describe('fuseProblems', () => {
	test('accepts a locked-down build', () => {
		expect(fuseProblems(wire(lockedDown))).toEqual([]);
	});

	test('reports every fuse left at the Electron default', () => {
		const defaults = { [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: FUSE_ENABLED, [FuseV1Options.OnlyLoadAppFromAsar]: FUSE_DISABLED, [FuseV1Options.RunAsNode]: FUSE_ENABLED };
		expect(fuseProblems(wire(defaults))).toHaveLength(3);
	});

	test('treats a missing fuse as a problem', () => {
		const { [FuseV1Options.OnlyLoadAppFromAsar]: _removed, ...rest } = lockedDown;
		expect(fuseProblems(wire(rest))).toEqual([expect.stringContaining('OnlyLoadAppFromAsar')]);
	});
});
