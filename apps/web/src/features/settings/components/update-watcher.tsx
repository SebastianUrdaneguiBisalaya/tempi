'use client';

import { useRef } from 'react';
import { toast } from '@/components/ui/toast';
import { i18n } from '@/lib/i18n';
import { useAppUpdates, useInstallUpdate } from '../hooks/use-app-update';

/**
 * Tells the user once per version when an update is waiting: ready to install on restart (Windows, Linux AppImage), or
 * newer on GitHub to download by hand (macOS, other Linux packages). The toast stays until dismissed.
 */
export function UpdateWatcher() {
	const install = useInstallUpdate();
	// The version already announced, so periodic checks don't repeat the toast.
	const announced = useRef<string | null>(null);

	useAppUpdates(status => {
		const version = status.latestVersion;
		if (version === null || announced.current === version) return;
		if (status.state === 'ready') {
			announced.current = version;
			toast.add({
				actionProps: { children: i18n.t('settings.about.restart'), onClick: () => install.mutate() },
				timeout: 0,
				title: i18n.t('settings.about.readyToast', { version }),
			});
		} else if (status.state === 'available' && status.downloadUrl !== null) {
			announced.current = version;
			const url = status.downloadUrl;
			toast.add({
				// The main process opens new-window requests in the system browser.
				actionProps: { children: i18n.t('settings.about.download', { version }), onClick: () => window.open(url, '_blank', 'noopener') },
				timeout: 0,
				title: i18n.t('settings.about.availableToast', { version }),
			});
		}
	});
	return null;
}
