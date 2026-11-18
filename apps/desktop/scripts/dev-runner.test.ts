import { describe, expect, test } from 'bun:test';
import { runDev } from './dev-runner';

// A watcher stand-in that, like `bun run build:main --watch`, keeps a child process alive.
const WATCHER = ['sh', '-c', 'sleep 30 & wait'] as const;

const groupAlive = (pid: number) => {
	try {
		process.kill(-pid, 0);
		return true;
	} catch {
		return false;
	}
};

describe('runDev', () => {
	test('stops every watcher and its children when the app exits', async () => {
		const { watcherPids } = await runDev({ watchers: [WATCHER, WATCHER], app: ['sh', '-c', 'sleep 0.2'] });
		expect(watcherPids).toHaveLength(2);
		for (const pid of watcherPids) expect(groupAlive(pid)).toBe(false);
	});

	// Ctrl+C stops every child by signal before the app's exit is handled: waiting on a watcher that already exited
	// that way used to hang forever, leaving this process running without its terminal.
	test('resolves when a watcher already exited by a signal', async () => {
		const { code } = await runDev({ watchers: [['sh', '-c', 'kill -TERM $$']], app: ['sh', '-c', 'sleep 0.3'] });
		expect(code).toBe(0);
	}, 2000);

	test("resolves with the app's exit code", async () => {
		const { code } = await runDev({ watchers: [WATCHER], app: ['sh', '-c', 'exit 3'] });
		expect(code).toBe(3);
	});
});
