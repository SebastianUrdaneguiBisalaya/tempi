'use client';

import { GoogleCalendar } from '@ridemountainpig/svgl-react';
import { resolveLanguage } from '@tempi/core';
import { LogOutIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { WEBSITE_URL } from '@/lib/site';
import { useConnectGoogle, useDisconnectGoogle, useGoogleAccount } from '../hooks/use-google-account';
import { AiIntegrations } from './ai-integrations';
import { GoogleSyncSettings } from './google-sync-settings';

/** Connects one Google account through the system browser, syncs its calendars, or disconnects it after confirming. */
export function IntegrationsSettings() {
	const { i18n, t } = useTranslation();
	const googleId = useId();
	const { data: account } = useGoogleAccount();
	const connect = useConnectGoogle();
	const disconnect = useDisconnectGoogle();
	const [confirming, setConfirming] = useState(false);

	return (
		<div className='flex flex-col gap-6 text-xs'>
			<section aria-labelledby={googleId}>
				<Card size='sm'>
					<CardHeader>
						<div className='flex items-center gap-3'>
							<GoogleCalendar aria-hidden className='size-8 shrink-0' />
							<div className='flex min-w-0 flex-col gap-0.5'>
								<CardTitle>
									<h3 id={googleId}>{t('settings.integrations.googleTitle')}</h3>
								</CardTitle>
								<CardDescription>{t('settings.integrations.googleDescription')}</CardDescription>
							</div>
						</div>
						{account === undefined ? null : (
							<CardAction>
								{account === null ? (
									// Clicking again while waiting restarts the sign-in, e.g. after closing the browser tab.
									<Button onClick={() => connect.mutate()} size='sm' variant='outline'>
										{connect.isPending && <Spinner data-icon='inline-start' />}
										{t('settings.integrations.connect')}
									</Button>
								) : (
									<Button disabled={disconnect.isPending} onClick={() => setConfirming(true)} size='sm' variant='outline'>
										<LogOutIcon data-icon='inline-start' />
										{t('settings.integrations.disconnect')}
									</Button>
								)}
							</CardAction>
						)}
					</CardHeader>
					{account === undefined ? null : (
						<CardContent className='flex flex-col items-start gap-4'>
							{account === null ? (
								<p aria-live='polite' className='text-muted-foreground'>
									{connect.isPending ? t('settings.integrations.waiting') : t('settings.integrations.notConnected')}
								</p>
							) : (
								<>
									<p className='break-all'>{t('settings.integrations.connectedAs', { email: account.email })}</p>
									<GoogleSyncSettings />
								</>
							)}
							<nav aria-label={t('settings.integrations.legal.label')} className='flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground'>
								{(['privacy', 'terms'] as const).map(page => (
									// Opens in the system browser: the main process sends new-window links there.
									<a
										className='rounded-sm underline-offset-4 hover:text-foreground hover:underline'
										href={`${WEBSITE_URL}/${resolveLanguage([i18n.language])}/${page}`}
										key={page}
										rel='noreferrer'
										target='_blank'
									>
										{t(`settings.integrations.legal.${page}`)}
									</a>
								))}
							</nav>
						</CardContent>
					)}
				</Card>
			</section>
			<AiIntegrations />
			<AlertDialog onOpenChange={setConfirming} open={confirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('settings.integrations.confirmTitle')}</AlertDialogTitle>
						<AlertDialogDescription>{t('settings.integrations.confirmDescription', { email: account?.email ?? '' })}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setConfirming(false);
								disconnect.mutate();
							}}
							variant='destructive'
						>
							{t('settings.integrations.confirm')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
