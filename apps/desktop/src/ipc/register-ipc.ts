import type { CoreDeps } from '@tempi/core';
import { registerCalendarHandlers } from './calendars';
import { registerEventHandlers } from './events';
import type { HandlerContext } from './handle';
import { registerProfileHandlers } from './profile';
import { registerSettingsHandlers } from './settings';

export type { HandlerContext, IpcRegistrar, IpcSender } from './handle';

/** Registers every channel of the `@tempi/ipc` contract, each running its core use case against `deps`. */
export const registerIpc = (context: HandlerContext, deps: CoreDeps): void => {
	registerCalendarHandlers(context, deps);
	registerEventHandlers(context, deps);
	registerProfileHandlers(context, deps);
	registerSettingsHandlers(context, deps);
};
