import { type CoreDeps, completeOnboarding, type Settings } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerOnboardingHandlers = (context: HandlerContext, deps: CoreDeps, onSettingsSaved?: (settings: Settings) => void): void => {
	handle(
		context,
		CHANNELS.onboarding.complete,
		input => completeOnboarding(deps, input),
		({ settings }) => onSettingsSaved?.(settings)
	);
};
