import { fail, ok, type Result } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handleRequest } from './handle';

/** What the data channels need from the app: native dialogs, the database file itself and the data folder. */
export type DataIo = {
	/** Asks where to save `defaultName`, or null if the user cancels. */
	chooseBackupPath: (defaultName: string) => Promise<string | null>;
	/** Asks for a backup file, or null if the user cancels. */
	chooseRestoreFile: () => Promise<string | null>;
	/** The folder that holds the database and every other file Tempi keeps (`userData`). */
	folder: () => string;
	now: () => Date;
	/** Opens `folder` in the system file manager; answers the OS's error message, or '' when it opened. */
	openFolder: (folder: string) => Promise<string>;
	/** Writes a backup of the database (and the files it carries) to `target`. */
	backup: (target: string) => Promise<void>;
	/** Checks `source`, puts it in place of the current data and schedules a relaunch; fails without touching anything when it isn't a valid backup. */
	restore: (source: string) => Promise<Result<null>>;
};

/** `data:backup`, `data:restore`, `data:folder` and `data:openFolder`. They work on the database file, not on rows, so they run outside the use-case transactions. */
export const registerDataHandlers = (context: HandlerContext, io: DataIo): void => {
	handleRequest(context, CHANNELS.data.backup, async () => {
		const target = await io.chooseBackupPath(`Tempi backup ${io.now().toISOString().slice(0, 10)}.db`);
		if (target === null) return ok({ status: 'canceled' });
		await io.backup(target);
		return ok({ status: 'saved' });
	});

	handleRequest(context, CHANNELS.data.folder, async () => ok(io.folder()));

	// The folder comes from the main process, never from the renderer, so a page can't make it open anything else.
	handleRequest(context, CHANNELS.data.openFolder, async () => {
		const folder = io.folder();
		const error = await io.openFolder(folder);
		return error === '' ? ok(null) : fail('internal', 'data.openFolderFailed', { detail: `Could not open ${folder}: ${error}` });
	});

	handleRequest(context, CHANNELS.data.restore, async () => {
		const source = await io.chooseRestoreFile();
		if (source === null) return ok({ status: 'canceled' });
		const restored = await io.restore(source);
		return restored.ok ? ok({ status: 'restarting' }) : restored;
	});
};
