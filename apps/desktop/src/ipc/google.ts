import { ok } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import type { GoogleAccountService } from '../google/google-account';
import { type HandlerContext, handleRequest } from './handle';

/** `google:*`. Tokens live in an encrypted file, not the database, so these run outside the use-case transactions. */
export const registerGoogleHandlers = (context: HandlerContext, google: GoogleAccountService): void => {
	handleRequest(context, CHANNELS.google.account, async () => ok(await google.account()));
	handleRequest(context, CHANNELS.google.connect, () => google.connect());
	handleRequest(context, CHANNELS.google.disconnect, () => google.disconnect());
};
