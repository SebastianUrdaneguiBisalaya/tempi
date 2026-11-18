'use client';

import { createContext, type ReactNode, use, useState } from 'react';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { useAppearancePreview } from '@/providers/appearance-preview-provider';
import { SettingsDialog, type SettingsTab } from './settings-dialog';

type SettingsDialogControls = { closeSettings: () => void; openSettings: (tab?: SettingsTab) => void };

const SettingsDialogContext = createContext<SettingsDialogControls | null>(null);

/** Owns the settings dialog: the header (avatar, gear button), ⌘, and later the command menu open it. */
export function SettingsDialogProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<SettingsTab | undefined>(undefined);
	const { setPreview } = useAppearancePreview();
	const openSettings = (next?: SettingsTab) => {
		setTab(next);
		setOpen(true);
	};
	useShortcut('openSettings', () => openSettings());

	const changeOpen = (next: boolean) => {
		setOpen(next);
		// A theme or language previewed but not saved goes away with the dialog.
		if (!next) setPreview({});
	};

	return (
		<SettingsDialogContext value={{ closeSettings: () => changeOpen(false), openSettings }}>
			{children}
			<SettingsDialog initialTab={tab} onOpenChange={changeOpen} open={open} />
		</SettingsDialogContext>
	);
}

export const useSettingsDialog = (): SettingsDialogControls => {
	const controls = use(SettingsDialogContext);
	if (controls === null) throw new Error('useSettingsDialog must be used inside SettingsDialogProvider');
	return controls;
};
