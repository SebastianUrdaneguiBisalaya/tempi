'use client';

import { useMutation } from '@tanstack/react-query';
import { backupResultSchema } from '@tempi/ipc';
import { useTranslation } from 'react-i18next';
import { STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** Saves a backup of all data to a file the user picks; a canceled dialog shows nothing. */
export const useCreateBackup = () => {
	const { t } = useTranslation();
	const api = useApi();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.data.backup());
		},
		meta: {
			progressMessage: 'toasts.creatingBackup',
			successToast: data => {
				const result = backupResultSchema.safeParse(data);
				return result.success && result.data.status === 'saved' ? t('toasts.backupCreated') : null;
			},
		},
	});
};

/** Replaces all data with a backup the user picks; on success the desktop app relaunches on it. */
export const useRestoreBackup = () => {
	const api = useApi();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.data.restore());
		},
		meta: { progressMessage: 'toasts.restoring' },
	});
};
