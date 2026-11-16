'use client';

import { LogOutIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useConnectGoogle, useDisconnectGoogle, useGoogleAccount } from '../hooks/use-google-account';

/** Connects one Google account through the system browser, or disconnects it after confirming. */
export function IntegrationsSettings() {
	const { t } = useTranslation();
	const googleId = useId();
	const { data: account } = useGoogleAccount();
	const connect = useConnectGoogle();
	const disconnect = useDisconnectGoogle();
	const [confirming, setConfirming] = useState(false);

	return (
		<div className='flex flex-col gap-6 text-xs'>
			<section aria-labelledby={googleId} className='flex flex-col items-start gap-2'>
				<h3 className='font-heading text-sm font-semibold' id={googleId}>
					{t('settings.integrations.googleTitle')}
				</h3>
				<p className='text-muted-foreground'>{t('settings.integrations.googleDescription')}</p>
				{account === undefined ? null : account === null ? (
					<>
						<p aria-live='polite'>{connect.isPending ? t('settings.integrations.waiting') : t('settings.integrations.notConnected')}</p>
						{/* Clicking again while waiting restarts the sign-in, e.g. after closing the browser tab. */}
						<Button onClick={() => connect.mutate()} variant='outline'>
							{connect.isPending && <Spinner data-icon='inline-start' />}
							{t('settings.integrations.connect')}
						</Button>
					</>
				) : (
					<>
						<p className='break-all'>{t('settings.integrations.connectedAs', { email: account.email })}</p>
						<Button disabled={disconnect.isPending} onClick={() => setConfirming(true)} variant='outline'>
							<LogOutIcon data-icon='inline-start' />
							{t('settings.integrations.disconnect')}
						</Button>
					</>
				)}
			</section>
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
