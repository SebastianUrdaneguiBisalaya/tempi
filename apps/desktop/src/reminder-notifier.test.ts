import { describe, expect, test } from 'bun:test';
import type { Reminder } from '@tempi/core';
import { createReminderNotifier, type NotificationApi } from './reminder-notifier';

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

const setup = ({ enabled = () => true, supported = true }: { enabled?: () => boolean; supported?: boolean } = {}) => {
	const shown: string[] = [];
	const clicks: Reminder[] = [];
	const listeners = new Map<string, () => void>();
	const notifications: NotificationApi = {
		create: ({ title }) => ({
			on: (event, listener) => listeners.set(event, listener),
			show: () => shown.push(title),
		}),
		isSupported: () => supported,
	};
	const notify = createReminderNotifier({
		display: () => Promise.resolve({ language: 'en', timeFormat: '24h', timeZone: 'America/Lima' }),
		enabled,
		notifications,
		onClick: clicked => clicks.push(clicked),
	});
	return { clicks, listeners, notify, shown };
};

describe('reminder notifier', () => {
	test('shows a reminder as a notification, and a click opens it', async () => {
		const { clicks, listeners, notify, shown } = setup();
		await notify(reminder);
		expect(shown).toEqual(['Standup']);
		listeners.get('click')?.();
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
});
