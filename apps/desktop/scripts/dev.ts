// `bun run dev`: builds once, then runs the watchers and Electron, and stops the watchers when Electron quits.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { runDev } from './dev-runner';

const cwd = path.join(import.meta.dir, '..');

const build = spawnSync('bun', ['run', 'build'], { cwd, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const { code } = await runDev({
	cwd,
	watchers: [
		['bun', 'run', 'build:main', '--watch'],
		['bun', 'run', 'build:preload', '--watch'],
		['bun', 'run', 'build:ical-worker', '--watch'],
	],
	app: ['bunx', 'electron', '.'],
});
process.exit(code);
