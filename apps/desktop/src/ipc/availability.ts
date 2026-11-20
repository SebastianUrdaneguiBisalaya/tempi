import { type CoreDeps, findFreeSlots, getProfile } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

/** Free time is read in the profile's zone, like the calendar shows it; the system's until onboarding saves one. */
export const registerAvailabilityHandlers = (context: HandlerContext, deps: CoreDeps, now: () => Temporal.Instant = () => Temporal.Now.instant()): void => {
	handle(context, CHANNELS.availability.freeSlots, async query => {
		const profile = await getProfile(deps);
		return findFreeSlots(deps, query, now(), profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
	});
};
