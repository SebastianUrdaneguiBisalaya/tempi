import { ok } from '@tempi/core';
import { CHANNELS, type OccurrenceRef } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

/** Window-level requests between the app's own windows. They touch no data, so their transaction is empty. */
export const registerAppHandlers = (context: HandlerContext, showEvent?: (ref: OccurrenceRef) => void): void => {
	handle(context, CHANNELS.app.showEvent, ref => {
		showEvent?.(ref);
		return Promise.resolve(ok(null));
	});
};
