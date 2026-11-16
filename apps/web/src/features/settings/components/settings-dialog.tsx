'use client';

import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProfile } from '@/features/profile/hooks/use-profile';
import { ShortcutList } from '@/features/shortcuts/components/shortcut-list';
import { useDialogShortcutScope } from '@/features/shortcuts/hooks/use-shortcut';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSettings } from '../hooks/use-settings';
import { AppearanceSettings } from './appearance-settings';
import { CalendarSettings } from './calendar-settings';
import { DataSettings } from './data-settings';
import { IntegrationsSettings } from './integrations-settings';
import { ProfileSettings } from './profile-settings';

const TABS = ['profile', 'appearance', 'calendar', 'integrations', 'shortcuts', 'data'] as const;

export type SettingsTab = (typeof TABS)[number];

// Tailwind's `md`: below it the tabs sit on top instead of on the side.
const SIDE_TABS_QUERY = '(min-width: 48rem)';

type SettingsDialogProps = {
	/** The tab shown on open; the first one when omitted. */
	initialTab?: SettingsTab;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

/** Profile and preferences after onboarding, one tab per area, each saved with its own button. */
export function SettingsDialog({ initialTab, onOpenChange, open }: SettingsDialogProps) {
	const { t } = useTranslation();
	const { data: profile } = useProfile();
	const { data: settings } = useSettings();
	const sideTabs = useMediaQuery(SIDE_TABS_QUERY, true);
	useDialogShortcutScope(open);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className='flex h-[min(40rem,calc(100svh-2rem))] flex-col sm:max-w-3xl'>
				<DialogHeader>
					<DialogTitle>{t('settings.title')}</DialogTitle>
					<DialogDescription className='sr-only'>{t('settings.description')}</DialogDescription>
				</DialogHeader>
				{/* Forms mount on open, so each starts from the stored values and drops unsaved edits when closed. */}
				{open && profile != null && settings !== undefined && (
					<Tabs className='min-h-0 flex-1 gap-4' defaultValue={initialTab ?? TABS[0]} orientation={sideTabs ? 'vertical' : 'horizontal'}>
						<TabsList aria-label={t('settings.title')} className={sideTabs ? 'w-40 shrink-0' : 'w-full'}>
							{TABS.map(tab => (
								<TabsTrigger key={tab} value={tab}>
									{t(`settings.tabs.${tab}`)}
								</TabsTrigger>
							))}
						</TabsList>
						<ScrollArea className='min-h-0 min-w-0 flex-1'>
							<div className='p-1'>
								<TabsContent value='profile'>
									<ProfileSettings profile={profile} />
								</TabsContent>
								<TabsContent value='appearance'>
									<AppearanceSettings settings={settings} />
								</TabsContent>
								<TabsContent value='calendar'>
									<CalendarSettings settings={settings} />
								</TabsContent>
								<TabsContent value='integrations'>
									<IntegrationsSettings />
								</TabsContent>
								<TabsContent className='text-xs' value='shortcuts'>
									<ShortcutList />
								</TabsContent>
								<TabsContent value='data'>
									<DataSettings />
								</TabsContent>
							</div>
						</ScrollArea>
					</Tabs>
				)}
			</DialogContent>
		</Dialog>
	);
}
