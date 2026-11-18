'use client';

import type { AppUpdateStatus } from '@tempi/core';
import { BugIcon, DownloadIcon, FileTextIcon, GlobeIcon, type LucideIcon, MapIcon, NotebookTextIcon, RefreshCwIcon, RotateCwIcon, ShieldIcon, SquareCodeIcon } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { useTour } from '@/features/tour/components/tour-provider';
import { formatDateTime } from '@/lib/date-format';
import { legalPageUrl, WEBSITE_URL } from '@/lib/site';
import { useAppUpdateStatus, useCheckForUpdates, useInstallUpdate } from '../hooks/use-app-update';
import { useSettings } from '../hooks/use-settings';
import { useSettingsDialog } from './settings-dialog-provider';

const AUTHOR = { name: 'Sebastian Marat Urdanegui Bisalaya', url: 'https://sebastianurdanegui.com' } as const;
const REPO_URL = 'https://github.com/SebastianUrdaneguiBisalaya/tempi';

/** Opens in the system browser: the main process sends new-window links there. */
function ExternalLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
	return (
		<a className={buttonVariants({ className: 'justify-start', size: 'sm', variant: 'ghost' })} href={href} rel='noreferrer' target='_blank'>
			<Icon data-icon='inline-start' />
			{label}
		</a>
	);
}

/** What Tempi is and who makes it, the installed version and its updates: where they stand, a manual check, and installing or downloading a new one. */
export function AboutSettings() {
	const { i18n, t } = useTranslation();
	const { data: status } = useAppUpdateStatus();
	const { data: settings } = useSettings();
	const timeZone = useTimeZone();
	const check = useCheckForUpdates();
	const install = useInstallUpdate();
	const { startTour } = useTour();
	const { closeSettings } = useSettingsDialog();

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
			<p className='max-w-prose text-muted-foreground'>{t('settings.about.description')}</p>
			<Button
				onClick={() => {
					// The tour walks the main screen, so the dialog gets out of the way first.
					closeSettings();
					startTour();
				}}
				size='sm'
				variant='outline'
			>
				<MapIcon data-icon='inline-start' />
				{t('tour.replay')}
			</Button>
			<p>
				{t('settings.about.madeBy')}{' '}
				<a className='font-medium underline underline-offset-4 hover:text-foreground' href={AUTHOR.url} rel='noreferrer' target='_blank'>
					{AUTHOR.name}
				</a>
			</p>
			<Separator />
			<h4 className='font-heading text-sm font-semibold'>{t('settings.about.updatesTitle')}</h4>
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
			<Separator />
			<nav aria-label={t('settings.about.linksTitle')} className='flex flex-col gap-1'>
				<h4 className='font-heading text-sm font-semibold'>{t('settings.about.linksTitle')}</h4>
				<div className='-mx-2 flex flex-wrap gap-1'>
					<ExternalLink href={WEBSITE_URL} icon={GlobeIcon} label={t('settings.about.links.website')} />
					<ExternalLink href={REPO_URL} icon={SquareCodeIcon} label={t('settings.about.links.source')} />
					<ExternalLink href={`${REPO_URL}/releases`} icon={NotebookTextIcon} label={t('settings.about.links.releases')} />
					<ExternalLink href={`${REPO_URL}/issues/new`} icon={BugIcon} label={t('settings.about.links.issue')} />
					<ExternalLink href={legalPageUrl('terms', i18n.language)} icon={FileTextIcon} label={t('settings.integrations.legal.terms')} />
					<ExternalLink href={legalPageUrl('privacy', i18n.language)} icon={ShieldIcon} label={t('settings.integrations.legal.privacy')} />
				</div>
			</nav>
			<p className='text-muted-foreground'>{t('settings.about.license', { year: new Date().getFullYear(), name: AUTHOR.name })}</p>
		</div>
	);
}
