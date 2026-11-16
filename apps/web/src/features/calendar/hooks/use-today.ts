import { useSyncExternalStore } from 'react';

// The clock is an external store: notify once the day changes in the time zone, so "today" stays right in an app
// left open overnight. One stable subscriber per zone, so React doesn't resubscribe on every render.
const subscribers = new Map<string, (onChange: () => void) => () => void>();
const subscriberFor = (timeZone: string) => {
	let subscribe = subscribers.get(timeZone);
	if (subscribe === undefined) {
		subscribe = onChange => {
			let timer: ReturnType<typeof setTimeout>;
			const schedule = () => {
				const now = Temporal.Now.zonedDateTimeISO(timeZone);
				const untilTomorrow = now.toPlainDate().add({ days: 1 }).toZonedDateTime({ timeZone }).epochMilliseconds - now.epochMilliseconds;
				timer = setTimeout(() => {
					onChange();
					schedule();
				}, untilTomorrow);
			};
			schedule();
			return () => clearTimeout(timer);
		};
		subscribers.set(timeZone, subscribe);
	}
	return subscribe;
};

// The static export is prerendered at build time, which isn't "today" for the user.
const getServerToday = (): null => null;

/**
 * Today in `timeZone`, or null while prerendering. A `YYYY-MM-DD` string rather than a `Temporal.PlainDate`:
 * the snapshot must stay equal between calls until the day changes.
 */
export const useToday = (timeZone: string): string | null => useSyncExternalStore(subscriberFor(timeZone), () => Temporal.Now.plainDateISO(timeZone).toString(), getServerToday);
