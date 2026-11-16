'use client';

import type { AppUpdateStatus } from '@tempi/core';
import { DownloadIcon, RefreshCwIcon, RotateCwIcon } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { formatDateTime } from '@/lib/date-format';
import { useAppUpdateStatus, useCheckForUpdates, useInstallUpdate } from '../hooks/use-app-update';
import { useSettings } from '../hooks/use-settings';

/** The installed version and its updates: where they stand, a manual check, and installing or downloading a new one. */
export function AboutSettings() {
	const { t } = useTranslation();
	const { data: status } = useAppUpdateStatus();
	const { data: settings } = useSettings();
	const timeZone = useTimeZone();
	const check = useCheckForUpdates();
	const install = useInstallUpdate();

	const statusText = (current: AppUpdateStatus) => t(`settings.about.status.${current.state}`, { version: current.latestVersion ?? '' });
	const busy = check.isPending || status?.state === 'checking' || status?.state === 'downloading';

	return (
		<div className='flex flex-col items-start gap-4 text-xs'>
			<div className='flex items-center gap-3'>
				{/* The white glyph on black, like the app icon. */}
				<Image alt='' className='size-12 rounded-lg bg-black' height={48} src='/tempi-icon.png' width={48} />
				<div className='flex flex-col gap-0.5'>
					<h3 className='font-heading text-sm font-semibold'>{t('settings.about.title')}</h3>
					{status !== undefined && <p className='text-muted-foreground'>{t('settings.about.version', { version: status.currentVersion })}</p>}
				</div>
			</div>
			<div className='flex flex-col gap-1'>
				<p aria-live='polite'>{status === undefined ? t('settings.about.status.unsupported') : statusText(status)}</p>
				{status?.checkedAt != null && settings !== undefined && (
					<p className='text-muted-foreground'>
						{t('settings.about.lastChecked', { time: formatDateTime(status.checkedAt, { language: settings.language, timeFormat: settings.timeFormat, timeZone }) })}
					</p>
				)}
			</div>
			<div className='flex flex-wrap gap-2'>
				{status?.state === 'ready' && (
					<Button disabled={install.isPending} onClick={() => install.mutate()} size='sm'>
						<RotateCwIcon data-icon='inline-start' />
						{t('settings.about.restart')}
					</Button>
				)}
				{status?.state === 'available' && status.downloadUrl !== null && status.latestVersion !== null && (
					// The main process opens new-window links in the system browser.
					<a className={buttonVariants({ size: 'sm' })} href={status.downloadUrl} rel='noreferrer' target='_blank'>
						<DownloadIcon data-icon='inline-start' />
						{t('settings.about.download', { version: status.latestVersion })}
					</a>
				)}
				{status !== undefined && status.state !== 'unsupported' && status.state !== 'ready' && (
					<Button disabled={busy} onClick={() => check.mutate()} size='sm' variant='outline'>
						{busy ? <Spinner data-icon='inline-start' /> : <RefreshCwIcon data-icon='inline-start' />}
						{t('settings.about.check')}
					</Button>
				)}
			</div>
		</div>
	);
}
