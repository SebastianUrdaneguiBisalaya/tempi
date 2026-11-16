import type { ProfileRepository } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerProfileHandlers = (context: HandlerContext, profile: ProfileRepository): void => {
	handle(context, CHANNELS.profile.get, () => profile.get());
	handle(context, CHANNELS.profile.save, async value => {
		await profile.save(value);
		return null;
	});
};
