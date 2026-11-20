import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Passed to the app when the OS starts it at login, so it starts without showing the main window. */
export const HIDDEN_ARG = '--hidden';

/** The part of Electron's `app` the login item needs; a fake stands in for it in tests. */
export type LoginItemApp = {
	setLoginItemSettings: (settings: { args?: string[]; openAtLogin: boolean }) => void;
};

type LoginItemOptions = {
	app: LoginItemApp;
	/** `process.env`: `XDG_CONFIG_HOME` and, inside an AppImage, `APPIMAGE`. */
	env: Readonly<Record<string, string | undefined>>;
	execPath: string;
	homeDir: string;
	platform: NodeJS.Platform;
};

export type LoginItem = {
	/** Starts Tempi at login, hidden, or stops doing so. */
	apply: (openAtLogin: boolean) => Promise<void>;
};

// The Desktop Entry spec: inside double quotes, `"`, `` ` ``, `$` and `\` are escaped with a backslash.
const quoteExecArgument = (value: string) => (/^[\w/.+,:@%=-]+$/.test(value) ? value : `"${value.replace(/["`$\\]/g, '\\$&')}"`);

export const autostartPath = (env: LoginItemOptions['env'], homeDir: string): string => {
	const configHome = env.XDG_CONFIG_HOME;
	// The spec says a relative value is invalid and must be ignored.
	const base = configHome !== undefined && path.isAbsolute(configHome) ? configHome : path.join(homeDir, '.config');
	return path.join(base, 'autostart', 'tempi.desktop');
};

// An AppImage runs from a temporary mount: only `APPIMAGE` (the file itself) still exists at the next login.
export const autostartEntry = (env: LoginItemOptions['env'], execPath: string): string => {
	const executable = env.APPIMAGE !== undefined && env.APPIMAGE !== '' ? env.APPIMAGE : execPath;
	return ['[Desktop Entry]', 'Type=Application', 'Name=Tempi', `Exec=${quoteExecArgument(executable)} ${HIDDEN_ARG}`, 'X-GNOME-Autostart-enabled=true', 'NoDisplay=true', ''].join('\n');
};

/** Opens Tempi at login: the OS login items on macOS and Windows, an XDG autostart entry on Linux. */
export const createLoginItem = (options: LoginItemOptions): LoginItem => ({
	apply: async openAtLogin => {
		if (options.platform === 'linux') {
			const file = autostartPath(options.env, options.homeDir);
			if (!openAtLogin) return rm(file, { force: true });
			await mkdir(path.dirname(file), { recursive: true });
			return writeFile(file, autostartEntry(options.env, options.execPath), 'utf8');
		}
		// macOS ignores `args` (and dropped `openAsHidden`): the app checks `wasOpenedAtLogin` there instead.
		options.app.setLoginItemSettings({ args: [HIDDEN_ARG], openAtLogin });
	},
});
