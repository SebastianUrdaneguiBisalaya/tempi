import type { CoreDeps } from '@tempi/core';
import { registerCalendarHandlers } from './calendars';
import { registerEventHandlers } from './events';
import type { HandlerContext } from './handle';
import { registerProfileHandlers } from './profile';
import { registerSettingsHandlers } from './settings';

export type { HandlerContext, IpcRegistrar, IpcSender } from './handle';

/** Registers every channel of the `@tempi/ipc` contract against the given repositories. */
export const registerIpc = (context: HandlerContext, repositories: Pick<CoreDeps, 'calendars' | 'events' | 'profile' | 'settings'>): void => {
	registerCalendarHandlers(context, repositories.calendars);
	registerEventHandlers(context, repositories.events);
	registerProfileHandlers(context, repositories.profile);
	registerSettingsHandlers(context, repositories.settings);
};
