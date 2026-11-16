import { type CoreDeps, getProfile, ok, saveProfile } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerProfileHandlers = (context: HandlerContext, deps: CoreDeps): void => {
	handle(context, CHANNELS.profile.get, async () => ok(await getProfile(deps)));
	handle(context, CHANNELS.profile.save, input => saveProfile(deps, input));
};
