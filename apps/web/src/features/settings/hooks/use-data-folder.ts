'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

/** The folder on this computer that holds all of Tempi's data; only the desktop app has one. */
export const useDataFolder = () => {
	const api = useApi();
	return useQuery({
		enabled: api !== null,
		queryFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.data.folder());
		},
		queryKey: queryKeys.data.folder,
	});
};

/** Puts the data folder's path on the clipboard, through the desktop app since its renderer can't write it. */
export const useCopyDataFolder = () => {
	const api = useApi();
	return useMutation({
		meta: { successMessage: 'toasts.dataFolderCopied' },
		mutationFn: async (path: string) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			unwrap(await api.app.copyText(path));
		},
	});
};

/** Opens the data folder in the system file manager. */
export const useOpenDataFolder = () => {
	const api = useApi();
	return useMutation({
		mutationFn: async () => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			unwrap(await api.data.openFolder());
		},
	});
};
