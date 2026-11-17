import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import type { Reminder } from '@tempi/core';
import { createReminderNotifier, deliverNotification, type NotificationApi } from './reminder-notifier';

const T0 = '2026-11-15T10:00:00.000Z';

const reminder: Reminder = {
	fireAt: '2026-11-20T13:50:00.000Z',
	occurrence: {
		allDay: false,
		calendarId: 'cal-1',
		createdAt: T0,
		deletedAt: null,
		description: null,
		endAt: '2026-11-20T15:00:00.000Z',
		exDates: [],
		icalUid: null,
		id: 'event-1',
		key: 'event-1',
		location: null,
		originalStartAt: null,
		recurringEventId: null,
		reminderMinutes: 10,
		rrule: null,
		series: null,
		startAt: '2026-11-20T14:00:00.000Z',
		status: 'confirmed',
		timeZone: 'America/Lima',
		title: 'Standup',
		updatedAt: T0,
		videoUrl: null,
	},
};

/** A fake OS. `outcome` decides what each notification emits once shown: `show`, `failed` with a reason, or nothing. */
const fakeNotifications = (supported = true, outcome: () => { failed: string } | 'show' | 'silent' = () => 'show') => {
	const shown: string[] = [];
	const listeners: Map<string, (...args: unknown[]) => void>[] = [];
	const api: NotificationApi = {
		create: ({ title }) => {
			const own = new Map<string, (...args: unknown[]) => void>();
			listeners.push(own);
			return {
				on: (event: string, listener: (...args: never[]) => void) => own.set(event, listener as (...args: unknown[]) => void),
				show: () => {
					const result = outcome();
					if (result === 'silent') return;
					if (result === 'show') {
						shown.push(title);
						own.get('show')?.();
					} else own.get('failed')?.({}, result.failed);
				},
			};
		},
		isSupported: () => supported,
	};
	return { api, listeners, shown };
};

const setup = ({ enabled = () => true, outcome, supported = true }: { enabled?: () => boolean; outcome?: () => { failed: string } | 'show'; supported?: boolean } = {}) => {
	const clicks: Reminder[] = [];
	const { api, listeners, shown } = fakeNotifications(supported, outcome);
	const notify = createReminderNotifier({
		display: () => Promise.resolve({ language: 'en', timeFormat: '24h', timeZone: 'America/Lima' }),
		enabled,
		notifications: api,
		onClick: clicked => clicks.push(clicked),
	});
	return { clicks, listeners: () => listeners[0] ?? new Map(), notify, shown };
};

afterEach(() => {
	errors?.mockRestore();
	errors = null;
});

let errors: ReturnType<typeof spyOn> | null = null;

describe('reminder notifier', () => {
	test('shows a reminder as a notification, and a click opens it', async () => {
		const { clicks, listeners, notify, shown } = setup();
		await notify(reminder);
		expect(shown).toEqual(['Standup']);
		listeners().get('click')?.();
		expect(clicks).toEqual([reminder]);
	});

	test('shows nothing while notifications are off in Tempi', async () => {
		const { notify, shown } = setup({ enabled: () => false });
		await notify(reminder);
		expect(shown).toEqual([]);
	});

	test('follows the setting as it changes', async () => {
		let enabled = false;
		const { notify, shown } = setup({ enabled: () => enabled });
		await notify(reminder);
		enabled = true;
		await notify(reminder);
		expect(shown).toEqual(['Standup']);
	});

	test('shows nothing where the OS has no notifications', async () => {
		const { notify, shown } = setup({ supported: false });
		await notify(reminder);
		expect(shown).toEqual([]);
	});

	test('logs a reminder the OS refuses, and keeps showing later ones', async () => {
		errors = spyOn(console, 'error').mockImplementation(() => undefined);
		let refuse = true;
		const { notify, shown } = setup({ outcome: () => (refuse ? { failed: 'Notifications are not allowed for this application' } : 'show') });
		await notify(reminder);
		expect(errors.mock.calls).toEqual([['The OS refused the reminder for event event-1: Notifications are not allowed for this application']]);
		refuse = false;
		await notify(reminder);
		expect(shown).toEqual(['Standup']);
	});
});

describe('deliverNotification', () => {
	const options = { body: 'Reminders are on.', title: 'Tempi' };

	test('resolves shown once the OS shows it', async () => {
		expect(await deliverNotification(fakeNotifications().api, options)).toEqual({ shown: true });
	});

	test('resolves with the OS reason when it refuses it', async () => {
		const { api } = fakeNotifications(true, () => ({ failed: 'Notifications are not allowed for this application' }));
		expect(await deliverNotification(api, options)).toEqual({ reason: 'Notifications are not allowed for this application', shown: false });
	});

	test('counts it as shown when the OS reports nothing in time', async () => {
		const { api } = fakeNotifications(true, () => 'silent');
		expect(await deliverNotification(api, options, 5)).toEqual({ shown: true });
	});

	test('refuses where the OS has no notifications', async () => {
		expect(await deliverNotification(fakeNotifications(false).api, options)).toEqual({ reason: 'Notifications are not supported on this system', shown: false });
	});
});
