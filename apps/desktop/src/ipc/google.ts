import { type CoreDeps, disconnectGoogleCalendars, listGoogleCalendars, ok, selectGoogleCalendars } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import type { GoogleAccountService } from '../google/google-account';
import type { SyncRunner } from '../google/sync-runner';
import { type HandlerContext, handle, handleRequest } from './handle';

/** The Google account and the sync that runs while it is connected. */
export type GoogleIo = { account: GoogleAccountService; sync: SyncRunner };

/**
 * `google:*`. Tokens live in an encrypted file and sync talks to Google, so account and sync calls run outside the
 * use-case transactions; the sync bookkeeping they change goes through use cases.
 */
export const registerGoogleHandlers = (context: HandlerContext, deps: CoreDeps, google: GoogleIo, onEventsChanged?: () => void): void => {
	handleRequest(context, CHANNELS.google.account, async () => ok(await google.account.account()));

	handleRequest(context, CHANNELS.google.connect, async () => {
		const result = await google.account.connect();
		if (result.ok && result.value.status === 'connected') {
			google.sync.start();
			// Connecting again (to grant calendar access) finds sync already running: sync with the new grant now.
			void google.sync.syncNow();
		}
		return result;
	});

	handleRequest(context, CHANNELS.google.disconnect, async () => {
		// No sync may write after the calendars are removed.
		await google.sync.stop();
		const disconnected = await google.account.disconnect();
		if (!disconnected.ok) return disconnected;
		const removed = await context.transaction(() => disconnectGoogleCalendars(deps));
		if (removed.ok) onEventsChanged?.();
		return removed;
	});

	handle(context, CHANNELS.google.calendars, async () => ok(await listGoogleCalendars(deps)));

	handle(
		context,
		CHANNELS.google.selectCalendars,
		input => selectGoogleCalendars(deps, input),
		() => {
			onEventsChanged?.();
			// Newly selected calendars arrive with the next sync; don't make the user wait for it.
			void google.sync.syncNow();
		}
	);

	handleRequest(context, CHANNELS.google.sync, async () => ok(await google.sync.syncNow()));
	handleRequest(context, CHANNELS.google.syncStatus, async () => ok(google.sync.status()));
};
