'use client';

import type { EventOccurrence } from '@tempi/core';
import { useApi } from '@/providers/api-provider';

/** Opens an occurrence in the main window, which the desktop app brings forward (reopening it if it was closed). */
export const useShowInMainWindow = () => {
	const api = useApi();
	return async (event: Pick<EventOccurrence, 'key' | 'startAt'>) => {
		if (api === null) return;
		const result = await api.app.showEvent({ key: event.key, startAt: event.startAt });
		// Nothing to tell the user: the main window either shows the event or stays as it was.
		if (!result.ok) for (const issue of result.error.issues) console.error(issue.detail);
	};
};
