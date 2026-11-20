import { type Language, meetingLink, type Reminder } from '@tempi/core';
import { type ReminderDisplay, reminderContent } from './reminder-notification.js';

/**
 * The part of an Electron `Notification` Tempi uses. `failed` comes with the OS's reason, e.g. on macOS when the build
 * isn't code-signed or the user blocked Tempi.
 */
export type ShownNotification = {
	on(event: 'action', listener: (details: { actionIndex: number }) => void): unknown;
	on(event: 'click' | 'close' | 'show', listener: () => void): unknown;
	on(event: 'failed', listener: (event: unknown, error: string) => void): unknown;
	show(): void;
};

type NotificationOptions = { actions?: { text: string; type: 'button' }[]; body: string; icon?: string; title: string };

/** Electron's `Notification`, injected so tests can stand in for the OS. */
export type NotificationApi = {
	create: (options: NotificationOptions) => ShownNotification;
	isSupported: () => boolean;
};

export type NotificationOutcome = { shown: true } | { reason: string; shown: false };

/**
 * How long to wait for `show` or `failed`. Some platforms (Linux) may emit neither; past this the notification counts
 * as shown, since nothing reported it refused.
 */
export const DELIVERY_TIMEOUT_MS = 5000;

/** Shows one notification and resolves once the OS shows or refuses it. */
export const deliverNotification = (notifications: NotificationApi, options: { body: string; icon?: string; title: string }, timeoutMs = DELIVERY_TIMEOUT_MS): Promise<NotificationOutcome> => {
	if (!notifications.isSupported()) return Promise.resolve({ reason: 'Notifications are not supported on this system', shown: false });
	return new Promise(resolve => {
		const notification = notifications.create(options);
		const timer = setTimeout(() => resolve({ shown: true }), timeoutMs);
		const settle = (outcome: NotificationOutcome) => {
			clearTimeout(timer);
			resolve(outcome);
		};
		notification.on('show', () => settle({ shown: true }));
		notification.on('failed', (_event, error) => settle({ reason: error, shown: false }));
		notification.show();
	});
};

type ReminderNotifierOptions = {
	/** How to show times, read when each reminder fires so it follows the latest settings and profile. */
	display: () => Promise<ReminderDisplay>;
	/** The user's `notificationsEnabled` setting, read when each reminder fires: while off, reminders show nothing. */
	enabled: () => boolean;
	/** Windows and Linux show this next to the text; macOS always uses the app icon. */
	icon?: string;
	/**
	 * A "Join" button on reminders of events with a call link, labelled in the reminder's language. Only macOS shows
	 * notification buttons, so only it passes this.
	 */
	join?: { label: (language: Language) => string; open: (url: string) => void };
	notifications: NotificationApi;
	onClick: (reminder: Reminder) => void;
};

/** Shows each reminder as a native OS notification; clicking one calls `onClick`. One the OS refuses is logged. */
export const createReminderNotifier = ({ display, enabled, icon, join, notifications, onClick }: ReminderNotifierOptions) => {
	// Electron drops the click handler of a notification that has been garbage-collected, so keep each until it's done.
	const shown = new Set<ShownNotification>();
	const show = async (reminder: Reminder) => {
		if (!enabled() || !notifications.isSupported()) return;
		const settings = await display();
		const link = join === undefined ? null : meetingLink(reminder.occurrence);
		const notification = notifications.create({
			...reminderContent(reminder, settings),
			...(icon === undefined ? {} : { icon }),
			...(join === undefined || link === null ? {} : { actions: [{ text: join.label(settings.language), type: 'button' }] }),
		});
		shown.add(notification);
		if (join !== undefined && link !== null) {
			notification.on('action', ({ actionIndex }) => {
				shown.delete(notification);
				if (actionIndex === 0) join.open(link.url);
			});
		}
		notification.on('click', () => {
			shown.delete(notification);
			onClick(reminder);
		});
		notification.on('close', () => shown.delete(notification));
		notification.on('failed', (_event, error) => {
			shown.delete(notification);
			console.error(`The OS refused the reminder for event ${reminder.occurrence.id}: ${error}`);
		});
		notification.show();
	};
	return (reminder: Reminder): Promise<void> => show(reminder).catch((error: unknown) => console.error('Failed to show a reminder', error));
};
