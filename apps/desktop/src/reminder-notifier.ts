import type { Reminder } from '@tempi/core';
import { Notification } from 'electron';
import { type ReminderDisplay, reminderContent } from './reminder-notification.js';

type ReminderNotifierOptions = {
	/** How to show times, read when each reminder fires so it follows the latest settings and profile. */
	display: () => Promise<ReminderDisplay>;
	/** Windows and Linux show this next to the text; macOS always uses the app icon. */
	icon?: string;
	onClick: (reminder: Reminder) => void;
};

/** Shows each reminder as a native OS notification; clicking one calls `onClick`. */
export const createReminderNotifier = ({ display, icon, onClick }: ReminderNotifierOptions) => {
	// Electron drops the click handler of a notification that has been garbage-collected, so keep each until it's done.
	const shown = new Set<Notification>();
	const show = async (reminder: Reminder) => {
		if (!Notification.isSupported()) return;
		const notification = new Notification({ ...reminderContent(reminder, await display()), ...(icon === undefined ? {} : { icon }) });
		shown.add(notification);
		notification.on('click', () => {
			shown.delete(notification);
			onClick(reminder);
		});
		notification.on('close', () => shown.delete(notification));
		notification.show();
	};
	return (reminder: Reminder): void => {
		show(reminder).catch((error: unknown) => console.error('Failed to show a reminder', error));
	};
};
