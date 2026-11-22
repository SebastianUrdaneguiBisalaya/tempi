'use client';

import { useHolidaySync } from '../hooks/use-holiday-sync';

/** Keeps the public holidays in the calendar in step with the profile country and the Holidays switch. */
export function HolidaySyncWatcher() {
	useHolidaySync();
	return null;
}
