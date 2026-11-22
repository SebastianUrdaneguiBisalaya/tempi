'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/features/profile/hooks/use-profile';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/**
 * Syncs the public holidays once per launch, and again when the profile country or the Holidays switch changes. The
 * main process fetches only what isn't stored yet, so most syncs read the database and nothing else. A failure shows
 * the QueryProvider's error toast and is retried on the next launch.
 */
export const useHolidaySync = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	const { data: profile } = useProfile();
	const { data: settings } = useSettings();
	const target = profile && settings ? { country: profile.country, enabled: settings.holidaysEnabled } : null;
	return useQuery({
		enabled: api !== null && target !== null,
		// Dropped once the key changes, so switching back (off, then on) syncs again instead of reusing the old answer.
		gcTime: 0,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			const result = unwrap(await api.holidays.sync());
			if (result.created + result.removed > 0) await queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
			return result;
		},
		queryKey: queryKeys.holidays.sync(target ?? { country: '', enabled: false }),
	});
};
