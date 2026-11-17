'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { OsPermission } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/**
 * What the OS allows for notifications and the microphone. Unlike app data, the user changes it outside Tempi (in the
 * system settings), so it's read again on mount and whenever the window regains focus.
 */
export const usePermissionStatus = () => {
	const api = useApi();
	return useQuery({
		enabled: api !== null,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.permissions.status());
		},
		queryKey: queryKeys.permissions.status,
		refetchOnMount: 'always',
		refetchOnWindowFocus: 'always',
	});
};

/** Opens the OS privacy page for one permission. Nothing changes in Tempi, so there's no success toast. */
export const useOpenSystemSettings = () => {
	const api = useApi();
	return useMutation({
		mutationFn: async (permission: OsPermission) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.permissions.openSystemSettings(permission));
		},
	});
};

/** Shows a test notification, which makes macOS ask for permission the first time. */
export const useTestNotification = () => {
	const api = useApi();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.permissions.testNotification());
		},
		// Only there to make macOS ask for permission. A refusal (e.g. the ad-hoc signed dev build) isn't something
		// the user can fix from a toast, so it's only logged.
		meta: { silentErrors: true },
	});
};
