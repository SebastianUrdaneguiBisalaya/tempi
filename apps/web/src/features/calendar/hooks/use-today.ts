import { addDays, startOfDay } from 'date-fns';
import { useSyncExternalStore } from 'react';

// The clock is an external store: notify once the local day changes, so "today" stays right in an app left open overnight.
const subscribe = (onChange: () => void) => {
	let timer: ReturnType<typeof setTimeout>;
	const schedule = () => {
		const now = new Date();
		timer = setTimeout(
			() => {
				onChange();
				schedule();
			},
			addDays(startOfDay(now), 1).getTime() - now.getTime()
		);
	};
	schedule();
	return () => clearTimeout(timer);
};

// A number, not a Date: the snapshot must stay equal between calls until the day changes.
const getToday = (): number => startOfDay(new Date()).getTime();
// The static export is prerendered at build time, which isn't "today" for the user.
const getServerToday = (): null => null;

/** Start of the current local day in epoch milliseconds, or null while prerendering. */
export const useToday = (): number | null => useSyncExternalStore(subscribe, getToday, getServerToday);
