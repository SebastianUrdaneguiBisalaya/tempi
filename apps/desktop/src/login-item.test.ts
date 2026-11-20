import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { autostartPath, createLoginItem, type LoginItemApp } from './login-item';

let home: string;

beforeEach(async () => {
	home = await mkdtemp(path.join(tmpdir(), 'tempi-login-'));
});

afterEach(() => rm(home, { force: true, recursive: true }));

const fakeApp = () => {
	const calls: Parameters<LoginItemApp['setLoginItemSettings']>[0][] = [];
	return { app: { setLoginItemSettings: settings => void calls.push(settings) } satisfies LoginItemApp, calls };
};

const entryFile = () => path.join(home, '.config', 'autostart', 'tempi.desktop');

describe('createLoginItem on Linux', () => {
	test('writes the autostart entry with the executable and --hidden, and removes it when turned off', async () => {
		const { app, calls } = fakeApp();
		const item = createLoginItem({ app, env: {}, execPath: '/opt/Tempi/tempi', homeDir: home, platform: 'linux' });
		await item.apply(true);
		const entry = await readFile(entryFile(), 'utf8');
		expect(entry).toContain('[Desktop Entry]');
		expect(entry).toContain('Exec=/opt/Tempi/tempi --hidden\n');
		await item.apply(false);
		await expect(access(entryFile())).rejects.toThrow();
		expect(calls).toEqual([]);
	});

	test('turning it off without an entry is not an error', async () => {
		const { app } = fakeApp();
		await createLoginItem({ app, env: {}, execPath: '/opt/Tempi/tempi', homeDir: home, platform: 'linux' }).apply(false);
		await expect(access(entryFile())).rejects.toThrow();
	});

	test('starts the AppImage file, quoted when its path has spaces', async () => {
		const { app } = fakeApp();
		const env = { APPIMAGE: '/home/me/Apps/Tempi 1.0.AppImage' };
		await createLoginItem({ app, env, execPath: '/tmp/.mount_Tempi/tempi', homeDir: home, platform: 'linux' }).apply(true);
		expect(await readFile(entryFile(), 'utf8')).toContain('Exec="/home/me/Apps/Tempi 1.0.AppImage" --hidden\n');
	});

	test('uses an absolute XDG_CONFIG_HOME and ignores a relative one', () => {
		expect(autostartPath({ XDG_CONFIG_HOME: '/xdg' }, home)).toBe(path.join('/xdg', 'autostart', 'tempi.desktop'));
		expect(autostartPath({ XDG_CONFIG_HOME: 'relative' }, home)).toBe(entryFile());
	});
});

describe('createLoginItem on macOS and Windows', () => {
	test.each(['darwin', 'win32'] as const)('%s sets the OS login item with --hidden and writes no file', async platform => {
		const { app, calls } = fakeApp();
		const item = createLoginItem({ app, env: {}, execPath: '/Applications/Tempi.app', homeDir: home, platform });
		await item.apply(true);
		await item.apply(false);
		expect(calls).toEqual([
			{ args: ['--hidden'], openAtLogin: true },
			{ args: ['--hidden'], openAtLogin: false },
		]);
		await expect(access(path.join(home, '.config'))).rejects.toThrow();
	});
});
