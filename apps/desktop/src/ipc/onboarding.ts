import { type CoreDeps, completeOnboarding, type Settings } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { callAvatars } from './call-avatars';
import { type HandlerContext, handle } from './handle';

export const registerOnboardingHandlers = (context: HandlerContext, deps: CoreDeps, onSettingsSaved?: (settings: Settings) => void): void => {
	handle(
		context,
		CHANNELS.onboarding.complete,
		(input, hooks) => completeOnboarding({ ...deps, avatars: callAvatars(deps.avatars, hooks) }, input),
		({ settings }) => onSettingsSaved?.(settings)
	);
};
