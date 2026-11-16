'use client';

import { useProfile } from './use-profile';

/** The IANA time zone the calendar is shown in: the profile's, or the system's until it loads (or outside the desktop app). */
export const useTimeZone = (): string => {
	const { data: profile } = useProfile();
	return profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
};
