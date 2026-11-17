// `bun run reset:dev`: deletes the dev app's database so the next `bun run dev` starts at the onboarding again.
// AI keys, the Google account and window state stay; they don't decide whether onboarding is due.
import { readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Electron's `app.getPath('userData')` in dev: the platform's app data folder plus package.json's `name`. The packaged
// app uses the same folder, so close every Tempi before running this.
const appData = (): string => {
	if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support');
	if (process.platform === 'win32') return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
	return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
};

const userData = path.join(appData(), '@tempi', 'desktop');

// The database with its WAL files and pre-migration backups, plus what only makes sense next to it: the avatar files
// the profile points to and the reminders checkpoint.
const DATABASE_FILE = /^tempi\.db(-wal|-shm|\.v\d+\.bak)?$/;

let entries: string[];
try {
	entries = readdirSync(userData);
} catch {
	console.log(`Nothing to reset: ${userData} doesn't exist.`);
	process.exit(0);
}

const targets = entries.filter(name => DATABASE_FILE.test(name) || name === 'avatars' || name === 'reminders.json');
for (const name of targets) rmSync(path.join(userData, name), { force: true, recursive: true });

console.log(targets.length === 0 ? `Nothing to reset in ${userData}.` : `Deleted from ${userData}:\n${targets.map(name => `  ${name}`).join('\n')}`);
