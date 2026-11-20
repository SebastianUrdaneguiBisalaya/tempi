'use client';

import { createContext, type ReactNode, use, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useDialogShortcutScope } from '@/features/shortcuts/hooks/use-shortcut';
import { StatsPanel } from './stats-panel';

type StatsControls = { openStats: () => void };

const StatsContext = createContext<StatsControls | null>(null);

/** Owns the time stats drawer, opened from the sidebar and the command menu. Its report is read only while open. */
export function StatsProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	useDialogShortcutScope(open);

	return (
		<StatsContext value={{ openStats: () => setOpen(true) }}>
			{children}
			<Drawer onOpenChange={setOpen} open={open} swipeDirection='right'>
				<DrawerContent className='w-full sm:max-w-xl'>
					<DrawerHeader>
						<DrawerTitle>{t('stats.title')}</DrawerTitle>
						<DrawerDescription>{t('stats.description')}</DrawerDescription>
					</DrawerHeader>
					{open && <StatsPanel />}
				</DrawerContent>
			</Drawer>
		</StatsContext>
	);
}

export const useStats = (): StatsControls => {
	const controls = use(StatsContext);
	if (controls === null) throw new Error('useStats must be used inside StatsProvider');
	return controls;
};
