import type { Reminder } from '@tempi/core';
import { type ReminderDisplay, reminderContent } from './reminder-notification.js';

/** The part of an Electron `Notification` the notifier uses. */
export type ShownNotification = { on(event: 'click' | 'close', listener: () => void): unknown; show(): void };

/** Electron's `Notification`, injected so tests can stand in for the OS. */
export type NotificationApi = {
	create: (options: { body: string; icon?: string; title: string }) => ShownNotification;
	isSupported: () => boolean;
};

type ReminderNotifierOptions = {
	/** How to show times, read when each reminder fires so it follows the latest settings and profile. */
	display: () => Promise<ReminderDisplay>;
	/** The user's `notificationsEnabled` setting, read when each reminder fires: while off, reminders show nothing. */
	enabled: () => boolean;
	/** Windows and Linux show this next to the text; macOS always uses the app icon. */
	icon?: string;
	notifications: NotificationApi;
	onClick: (reminder: Reminder) => void;
};

/** Shows each reminder as a native OS notification; clicking one calls `onClick`. */
export const createReminderNotifier = ({ display, enabled, icon, notifications, onClick }: ReminderNotifierOptions) => {
	// Electron drops the click handler of a notification that has been garbage-collected, so keep each until it's done.
	const shown = new Set<ShownNotification>();
	const show = async (reminder: Reminder) => {
		if (!enabled() || !notifications.isSupported()) return;
		const notification = notifications.create({ ...reminderContent(reminder, await display()), ...(icon === undefined ? {} : { icon }) });
		shown.add(notification);
		notification.on('click', () => {
			shown.delete(notification);
			onClick(reminder);
		});
		notification.on('close', () => shown.delete(notification));
		notification.show();
	};
	return (reminder: Reminder): Promise<void> => show(reminder).catch((error: unknown) => console.error('Failed to show a reminder', error));
};
