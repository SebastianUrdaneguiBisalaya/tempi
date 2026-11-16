'use client';

import { useIsMutating } from '@tanstack/react-query';
import type { GoogleSyncStatus } from '@tempi/core';
import { issueTranslation } from '@tempi/i18n';
import { useRef } from 'react';
import { toast } from '@/components/ui/toast';
import { i18n } from '@/lib/i18n';
import { SYNC_NOW_KEY, useGoogleSyncUpdates } from '../hooks/use-google-sync';

/** Problems that need the user, reported once when a background sync first runs into them. Offline just waits. */
const NEEDS_ATTENTION: readonly GoogleSyncStatus['state'][] = ['error', 'reconnect'];

/**
 * Keeps the app in step with background Google syncs: views refresh after each one, and a sync that starts failing
 * shows one error toast (a Sync now the user started reports its own outcome).
 */
export function GoogleSyncWatcher() {
	const syncingNow = useIsMutating({ mutationKey: SYNC_NOW_KEY }) > 0;
	// How the last sync ended, so a problem that persists across attempts is reported once.
	const lastError = useRef<GoogleSyncStatus['error']>(null);

	useGoogleSyncUpdates(status => {
		if (status.state === 'syncing') return;
		const before = lastError.current;
		lastError.current = status.error;
		if (syncingNow || status.error === null || status.error === before || !NEEDS_ATTENTION.includes(status.state)) return;
		const { key, options } = issueTranslation({ key: status.error });
		// Like the QueryProvider: params are only known at runtime, and a `defaultValue` selects i18next's untyped overload.
		toast.add({ title: i18n.t(key, { ...options, defaultValue: i18n.t('system.unexpected', { ns: 'errors' }) }), type: 'error' });
	});
	return null;
}
