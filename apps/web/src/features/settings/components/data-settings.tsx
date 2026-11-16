'use client';

import { DatabaseBackupIcon, HistoryIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useCreateBackup, useRestoreBackup } from '../hooks/use-data-backup';

/** Backups of all data to a file, and restoring one after confirming, which relaunches the app. */
export function DataSettings() {
	const { t } = useTranslation();
	const backupId = useId();
	const restoreId = useId();
	const createBackup = useCreateBackup();
	const restoreBackup = useRestoreBackup();
	const [confirming, setConfirming] = useState(false);
	const busy = createBackup.isPending || restoreBackup.isPending;

	return (
		<div className='flex flex-col gap-6 text-xs'>
			<section aria-labelledby={backupId} className='flex flex-col items-start gap-2'>
				<h3 className='font-heading text-sm font-semibold' id={backupId}>
					{t('settings.data.backupTitle')}
				</h3>
				<p className='text-muted-foreground'>{t('settings.data.backupDescription')}</p>
				<Button disabled={busy} onClick={() => createBackup.mutate()} variant='outline'>
					<DatabaseBackupIcon data-icon='inline-start' />
					{t('settings.data.backup')}
				</Button>
			</section>
			<section aria-labelledby={restoreId} className='flex flex-col items-start gap-2'>
				<h3 className='font-heading text-sm font-semibold' id={restoreId}>
					{t('settings.data.restoreTitle')}
				</h3>
				<p className='text-muted-foreground'>{t('settings.data.restoreDescription')}</p>
				<Button disabled={busy} onClick={() => setConfirming(true)} variant='outline'>
					<HistoryIcon data-icon='inline-start' />
					{t('settings.data.restore')}
				</Button>
			</section>
			<AlertDialog onOpenChange={setConfirming} open={confirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('settings.data.confirmTitle')}</AlertDialogTitle>
						<AlertDialogDescription>{t('settings.data.confirmDescription')}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setConfirming(false);
								restoreBackup.mutate();
							}}
							variant='destructive'
						>
							{t('settings.data.confirm')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
