// Checks the fuses of every packaged app in `release/`; the release workflow runs it after electron-builder.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getCurrentFuseWire } from '@electron/fuses';
import { fuseProblems } from '../src/release-fuses';

const RELEASE_DIR = path.join(import.meta.dir, '..', 'release');
// electron-builder's unpacked output for each platform and architecture.
const CANDIDATES = ['mac/Tempi.app', 'mac-arm64/Tempi.app', 'win-unpacked/Tempi.exe', 'linux-unpacked/tempi'];

const apps = CANDIDATES.map(candidate => path.join(RELEASE_DIR, candidate)).filter(existsSync);
if (apps.length === 0) {
	console.error(`No packaged app found in ${RELEASE_DIR}`);
	process.exit(1);
}

let failed = false;
for (const app of apps) {
	const problems = fuseProblems(await getCurrentFuseWire(app));
	for (const problem of problems) console.error(`${app}: ${problem}`);
	if (problems.length === 0) console.log(`${app}: fuses OK`);
	failed ||= problems.length > 0;
}
process.exit(failed ? 1 : 0);
