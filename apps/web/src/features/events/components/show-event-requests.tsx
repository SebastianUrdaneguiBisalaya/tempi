'use client';

import { useReminderClicks } from '../hooks/use-reminder-clicks';

/** Opens the event of a clicked reminder notification in the calendar and the panel. */
export function ReminderClicks() {
	useReminderClicks();
	return null;
}
