'use client';

import type { GoogleSyncStatus } from '@tempi/core';
import { RefreshCwIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { formatDateTime } from '@/lib/date-format';
import { useConnectGoogle } from '../hooks/use-google-account';
import { useGoogleCalendars, useGoogleSyncStatus, useSelectGoogleCalendars, useSyncNow } from '../hooks/use-google-sync';
import { useSettings } from '../hooks/use-settings';

/** Sync for the connected account: where it stands, Sync now (or Reconnect), and which calendars sync. */
export function GoogleSyncSettings() {
	const { t } = useTranslation();
	const id = useId();
	const { data: status } = useGoogleSyncStatus();
	const { data: settings } = useSettings();
	const timeZone = useTimeZone();
	const syncNow = useSyncNow();
	const connect = useConnectGoogle();
	const { data: calendars } = useGoogleCalendars(true);
	const select = useSelectGoogleCalendars();

	const statusText = (current: GoogleSyncStatus) => {
		if (current.state !== 'idle') return t(`settings.integrations.status.${current.state}`);
		if (current.lastSyncedAt === null || settings === undefined) return t('settings.integrations.status.never');
		return t('settings.integrations.status.idle', { time: formatDateTime(current.lastSyncedAt, { language: settings.language, timeFormat: settings.timeFormat, timeZone }) });
	};

	const toggle = (googleId: string, selected: boolean) => {
		if (calendars === undefined) return;
		select.mutate(calendars.filter(calendar => (calendar.googleId === googleId ? selected : calendar.selected)).map(calendar => calendar.googleId));
	};

	const syncing = status?.state === 'syncing' || syncNow.isPending;

	return (
		<div className='flex flex-col items-start gap-4'>
			<div className='flex flex-wrap items-center gap-2'>
				{status !== undefined && (
					<p aria-live='polite' className='text-muted-foreground'>
						{statusText(status)}
					</p>
				)}
				{status?.state === 'reconnect' ? (
					<Button disabled={connect.isPending} onClick={() => connect.mutate()} size='sm' variant='outline'>
						{connect.isPending && <Spinner data-icon='inline-start' />}
						{t('settings.integrations.reconnect')}
					</Button>
				) : (
					<Button disabled={syncing} onClick={() => syncNow.mutate()} size='sm' variant='outline'>
						{syncing ? <Spinner data-icon='inline-start' /> : <RefreshCwIcon data-icon='inline-start' />}
						{t('settings.integrations.syncNow')}
					</Button>
				)}
			</div>
			<FieldSet className='w-full'>
				<FieldLegend variant='label'>{t('settings.integrations.calendarsTitle')}</FieldLegend>
				<FieldDescription>{t('settings.integrations.calendarsDescription')}</FieldDescription>
				{calendars !== undefined && calendars.length === 0 && <p className='text-muted-foreground'>{t('settings.integrations.calendarsEmpty')}</p>}
				{calendars?.map(calendar => (
					<Field key={calendar.googleId} orientation='horizontal'>
						<Checkbox checked={calendar.selected} disabled={select.isPending} id={`${id}-${calendar.googleId}`} onCheckedChange={checked => toggle(calendar.googleId, checked)} />
						<FieldLabel className='min-w-0 font-normal' htmlFor={`${id}-${calendar.googleId}`}>
							<span aria-hidden className='size-3 shrink-0 rounded-sm' style={{ backgroundColor: calendar.color }} />
							<span className='truncate'>{calendar.name}</span>
							{calendar.accessRole === 'reader' && <Badge variant='outline'>{t('settings.integrations.readOnly')}</Badge>}
						</FieldLabel>
					</Field>
				))}
			</FieldSet>
		</div>
	);
}
