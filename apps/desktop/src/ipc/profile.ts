import { type CoreDeps, getProfile, ok, updateProfile } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerProfileHandlers = (context: HandlerContext, deps: CoreDeps): void => {
	handle(context, CHANNELS.profile.get, async () => ok(await getProfile(deps)));
	handle(context, CHANNELS.profile.update, async (input, { afterCommit }) => {
		const result = await updateProfile(deps, input);
		if (!result.ok) return result;
		const { profile, replacedAvatar } = result.value;
		// Only once the profile no longer points at it for good: a rolled-back update still needs the old image.
		if (replacedAvatar !== null) afterCommit(() => deps.avatars.remove(replacedAvatar));
		return ok(profile);
	});
};
