'use client';

import { createContext, type ReactNode, use, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDialogShortcutScope } from '@/features/shortcuts/hooks/use-shortcut';
import { ShareAvailabilityForm } from './share-availability-form';

type ShareAvailabilityControls = { openShareAvailability: () => void };

const ShareAvailabilityContext = createContext<ShareAvailabilityControls | null>(null);

/** Owns the share availability dialog, opened from the command menu. Its form starts over on every opening. */
export function ShareAvailabilityProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	useDialogShortcutScope(open);

	return (
		<ShareAvailabilityContext value={{ openShareAvailability: () => setOpen(true) }}>
			{children}
			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>{t('availability.title')}</DialogTitle>
						<DialogDescription>{t('availability.description')}</DialogDescription>
					</DialogHeader>
					{open && <ShareAvailabilityForm />}
				</DialogContent>
			</Dialog>
		</ShareAvailabilityContext>
	);
}

export const useShareAvailability = (): ShareAvailabilityControls => {
	const controls = use(ShareAvailabilityContext);
	if (controls === null) throw new Error('useShareAvailability must be used inside ShareAvailabilityProvider');
	return controls;
};
