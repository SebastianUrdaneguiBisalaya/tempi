import { useSyncExternalStore } from 'react';

const MINUTE = 60_000;

// Ticks on each minute boundary, so a clock drawn from it changes exactly when the wall clock does.
const subscribe = (onChange: () => void) => {
	let timer: ReturnType<typeof setTimeout>;
	const schedule = () => {
		timer = setTimeout(
			() => {
				onChange();
				schedule();
			},
			MINUTE - (Date.now() % MINUTE)
		);
	};
	schedule();
	return () => clearTimeout(timer);
};

const getMinute = (): number => Math.floor(Date.now() / MINUTE);
const getServerMinute = (): null => null;

/** The current instant in epoch milliseconds, updated every minute; null while prerendering. */
export const useMinute = (): number | null => {
	const minute = useSyncExternalStore(subscribe, getMinute, getServerMinute);
	return minute === null ? null : minute * MINUTE;
};
