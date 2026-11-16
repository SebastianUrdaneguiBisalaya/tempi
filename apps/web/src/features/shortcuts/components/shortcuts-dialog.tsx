'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDialogShortcutScope, useShortcut } from '../hooks/use-shortcut';
import { ShortcutList } from './shortcut-list';

/** `?` opens the list of every shortcut. */
export function ShortcutsDialog() {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	useShortcut('showShortcuts', () => setOpen(true));
	useDialogShortcutScope(open);

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('shortcuts.title')}</DialogTitle>
				</DialogHeader>
				<ScrollArea className='max-h-[70svh]'>
					<ShortcutList />
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
