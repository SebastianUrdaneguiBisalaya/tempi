'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { ReminderTarget } from '@tempi/ipc';
import { useEffect, useEffectEvent } from 'react';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';
import { useShowEvent } from './use-show-event';

/**
 * Shows the event of each clicked reminder notification. The occurrence is read again by its start and key, so the
 * panel opens with the event as it is now; one deleted since the reminder fired simply doesn't open.
 */
export const useReminderClicks = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	const showEvent = useShowEvent();

	const open = useEffectEvent(async ({ key, startAt }: ReminderTarget) => {
		// The narrowest range that holds the occurrence: it starts at `startAt`.
		const range = { end: new Date(Date.parse(startAt) + 1).toISOString(), start: startAt };
		const events = await queryClient.fetchQuery({
			queryFn: async () => {
				if (api === null) throw STORAGE_UNAVAILABLE;
				return unwrap(await api.events.list(range));
			},
			queryKey: queryKeys.events.range(range),
		});
		const occurrence = events.find(event => event.key === key);
		if (occurrence !== undefined) showEvent(occurrence);
	});

	useEffect(() => {
		// The QueryProvider already reports a failed read; this only keeps the rejection from going unhandled.
		return api?.reminders.onOpen(target => void open(target).catch(() => undefined));
	}, [api]);
};
