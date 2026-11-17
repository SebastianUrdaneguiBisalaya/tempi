import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';

type Command = readonly [string, ...string[]];

type DevOptions = {
	/** Long-running rebuilders (`bun build --watch`) that live only as long as the app. */
	watchers: readonly Command[];
	/** The app itself; when it exits, so does everything else. */
	app: Command;
	cwd?: string;
};

// Each child leads its own process group, so stopping it also stops what it started (`bun run` → `bun build`).
const start = ([command, ...args]: Command, cwd: string | undefined) => spawn(command, args, { cwd, detached: true, stdio: 'inherit' });

const stop = (child: ChildProcess) => {
	if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
	try {
		process.kill(-child.pid, 'SIGTERM');
	} catch {
		// The group already exited.
	}
};

const exitCode = async (child: ChildProcess): Promise<number> => {
	if (child.exitCode !== null) return child.exitCode;
	const [code] = (await once(child, 'exit')) as [number | null];
	return code ?? 1;
};

/**
 * Starts the watchers and the app, and stops every watcher when the app exits or this process is interrupted.
 * Resolves with the app's exit code and the watchers' process ids.
 */
export async function runDev({ watchers, app, cwd }: DevOptions): Promise<{ code: number; watcherPids: number[] }> {
	const children = watchers.map(watcher => start(watcher, cwd));
	const appProcess = start(app, cwd);

	const interrupt = () => {
		for (const child of [...children, appProcess]) stop(child);
	};
	process.on('SIGINT', interrupt);
	process.on('SIGTERM', interrupt);

	const code = await exitCode(appProcess);
	for (const child of children) stop(child);
	await Promise.all(children.map(exitCode));

	process.off('SIGINT', interrupt);
	process.off('SIGTERM', interrupt);
	return { code, watcherPids: children.flatMap(child => (child.pid === undefined ? [] : [child.pid])) };
}
