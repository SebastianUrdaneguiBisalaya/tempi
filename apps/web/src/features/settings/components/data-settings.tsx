'use client';

import { CopyIcon, DatabaseBackupIcon, FolderOpenIcon, HistoryIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCreateBackup, useRestoreBackup } from '../hooks/use-data-backup';
import { useCopyDataFolder, useDataFolder, useOpenDataFolder } from '../hooks/use-data-folder';

/** Where Tempi keeps its data on this computer, to copy the path or open the folder. Hidden outside the desktop app. */
function DataFolder() {
	const { t } = useTranslation();
	const titleId = useId();
	const descriptionId = useId();
	const folder = useDataFolder();
	const copy = useCopyDataFolder();
	const open = useOpenDataFolder();
	if (folder.data === undefined) return null;
	const path = folder.data;
	const copyLabel = t('settings.data.copyFolder');

	return (
		<section aria-labelledby={titleId} className='flex flex-col items-start gap-2'>
			<h3 className='font-heading text-sm font-semibold' id={titleId}>
				{t('settings.data.folderTitle')}
			</h3>
			<p className='text-muted-foreground' id={descriptionId}>
				{t('settings.data.folderDescription')}
			</p>
			<InputGroup className='w-full'>
				{/* Read-only rather than plain text so a long path scrolls inside the field and can still be selected by hand. */}
				<InputGroupInput aria-describedby={descriptionId} aria-label={t('settings.data.folderTitle')} className='font-mono' readOnly value={path} />
				<InputGroupAddon align='inline-end'>
					<Tooltip>
						<TooltipTrigger render={<InputGroupButton aria-label={copyLabel} disabled={copy.isPending} onClick={() => copy.mutate(path)} size='icon-xs' />}>
							<CopyIcon />
						</TooltipTrigger>
						<TooltipContent>{copyLabel}</TooltipContent>
					</Tooltip>
				</InputGroupAddon>
			</InputGroup>
			<Button disabled={open.isPending} onClick={() => open.mutate()} variant='outline'>
				<FolderOpenIcon data-icon='inline-start' />
				{t('settings.data.openFolder')}
			</Button>
		</section>
	);
}

/** The data folder, backups of all data to a file, and restoring one after confirming, which relaunches the app. */
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
			<DataFolder />
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
