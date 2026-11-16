import { type CoreDeps, type ExportedCalendars, exportEvents, getProfile, getSettings, importEvents, ok, type Result } from '@tempi/core';
import type { ParsedIcs, ParseOptions } from '@tempi/ical';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handleRequest } from './handle';

/** What import and export need outside the database: native dialogs, files, and the parser in its own process. */
export type IcalIo = {
	/** Asks for an `.ics` file and returns its text, or null if the user cancels. */
	chooseImportFile: () => Promise<string | null>;
	/** Asks where to save `defaultName`, or null if the user cancels. */
	chooseExportPath: (defaultName: string) => Promise<string | null>;
	now: () => Date;
	parse: (text: string, options: ParseOptions) => Promise<Result<ParsedIcs>>;
	serialize: (data: ExportedCalendars, now: Date) => Promise<string>;
	writeFile: (path: string, text: string) => Promise<void>;
};

// Characters file systems refuse in a name.
const fileName = (name: string) => `${name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Tempi'}.ics`;

/**
 * `calendars:import` and `calendars:export`. Dialogs, files and parsing happen outside any transaction, so the app
 * stays responsive while the user picks a file; only the import's writes run as one transaction, which leaves the
 * calendar untouched when the file is invalid or anything fails.
 */
export const registerIcalHandlers = (context: HandlerContext, deps: CoreDeps, io: IcalIo, onChanged?: () => void): void => {
	handleRequest(context, CHANNELS.calendars.import, async ({ calendarId }) => {
		const read = await context.transaction(async () => ok({ profile: await getProfile(deps), settings: await getSettings(deps) }));
		if (!read.ok) return read;
		const { profile, settings } = read.value;

		const text = await io.chooseImportFile();
		if (text === null) return ok({ status: 'canceled' });
		const parsed = await io.parse(text, {
			defaultDurationMinutes: settings.defaultEventDuration,
			timeZone: profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
		});
		if (!parsed.ok) return parsed;

		const imported = await context.transaction(() => importEvents(deps, { calendarId, events: parsed.value.events }));
		if (!imported.ok) return imported;
		onChanged?.();
		return ok({ ...imported.value, skipped: imported.value.skipped + parsed.value.skipped, status: 'imported' });
	});

	handleRequest(context, CHANNELS.calendars.export, async input => {
		const data = await context.transaction(() => exportEvents(deps, input));
		if (!data.ok) return data;

		const [only] = data.value.calendars;
		const path = await io.chooseExportPath(fileName(input.calendarId === null || only === undefined ? 'Tempi' : only.name));
		if (path === null) return ok({ status: 'canceled' });
		await io.writeFile(path, await io.serialize(data.value, io.now()));
		return ok({ count: data.value.events.length, status: 'exported' });
	});
};
