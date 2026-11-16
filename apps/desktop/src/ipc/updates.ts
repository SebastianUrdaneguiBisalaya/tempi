import { ok } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import type { UpdateService } from '../updates/update-service';
import { type HandlerContext, handleRequest } from './handle';

/** `updates:*`. Checks talk to GitHub and nothing touches the database, so they run outside the use-case transactions. */
export const registerUpdateHandlers = (context: HandlerContext, updates: UpdateService): void => {
	handleRequest(context, CHANNELS.updates.status, async () => ok(updates.status()));
	handleRequest(context, CHANNELS.updates.check, async () => ok(await updates.check()));
	handleRequest(context, CHANNELS.updates.install, () => {
		updates.install();
		return Promise.resolve(ok(null));
	});
};
