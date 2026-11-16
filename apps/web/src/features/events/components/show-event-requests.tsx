'use client';

import { useShowEventRequests } from '../hooks/use-show-event-requests';

/** Opens in the calendar and the panel each occurrence the main process asks to show (reminders, the menu bar calendar). */
export function ShowEventRequests() {
	useShowEventRequests();
	return null;
}
