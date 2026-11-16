'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exportResultSchema, importResultSchema } from '@tempi/ipc';
import { useTranslation } from 'react-i18next';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Imports an `.ics` file the user picks into a calendar; a canceled dialog shows nothing. */
export const useImportCalendar = () => {
	const { t } = useTranslation();
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (calendarId: string) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.calendars.import({ calendarId }));
		},
		meta: {
			progressMessage: 'toasts.importing',
			successToast: data => {
				const result = importResultSchema.safeParse(data);
				if (!result.success || result.data.status !== 'imported') return null;
				const { created, skipped, updated } = result.data;
				return t('toasts.imported', { created, skipped, updated });
			},
		},
		onSuccess: result => (result.status === 'imported' ? queryClient.invalidateQueries({ queryKey: queryKeys.events.all }) : undefined),
	});
};

/** Exports one calendar, or every calendar when given null, to an `.ics` file the user picks. */
export const useExportCalendars = () => {
	const { t } = useTranslation();
	const api = useApi();
	return useMutation({
		mutationFn: async (calendarId: string | null) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.calendars.export({ calendarId }));
		},
		meta: {
			progressMessage: 'toasts.exporting',
			successToast: data => {
				const result = exportResultSchema.safeParse(data);
				return result.success && result.data.status === 'exported' ? t('toasts.exported', { count: result.data.count }) : null;
			},
		},
	});
};
