'use client';

import { CALENDAR_VIEWS, isCalendarView, resolveLanguage } from '@tempi/core';
import { ChevronLeftIcon, ChevronRightIcon, PanelLeftIcon, PanelRightIcon, SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useSettingsDialog } from '@/features/settings/components/settings-dialog-provider';
import { ShortcutKeys } from '@/features/shortcuts/components/shortcut-keys';
import { SHORTCUTS } from '@/features/shortcuts/shortcuts';
import { TOUR_TARGETS } from '@/features/tour/tour-steps';
import { formatMonthYear } from '@/lib/date-format';
import { toUtcDate } from '@/lib/plain-date';
import { UserAvatarButton } from './user-avatar';

type AppHeaderProps = {
	onTogglePanel: () => void;
	onToggleSidebar: () => void;
	panelOpen: boolean;
	sidebarOpen: boolean;
};

export function AppHeader({ onTogglePanel, onToggleSidebar, panelOpen, sidebarOpen }: AppHeaderProps) {
	const { i18n, t } = useTranslation();
	const { date, goToNext, goToPrevious, goToToday, setView, view } = useCalendarNavigation();
	const { openSettings } = useSettingsDialog();

	return (
		<header className='flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2'>
			<div className='flex min-w-0 flex-1 items-center gap-2'>
				<Tooltip>
					<TooltipTrigger render={<Button aria-expanded={sidebarOpen} aria-label={t('shell.sidebar.toggle')} onClick={onToggleSidebar} size='icon' variant='ghost' />}>
						<PanelLeftIcon />
					</TooltipTrigger>
					<TooltipContent>
						{t('shell.sidebar.toggle')} <ShortcutKeys keys={[SHORTCUTS.toggleSidebar.keys]} />
					</TooltipContent>
				</Tooltip>
				<UserAvatarButton label={t('settings.open')} onClick={() => openSettings()} />
				<nav aria-label={t('shell.header.label')} className='flex items-center gap-1' data-tour={TOUR_TARGETS.navigation}>
					<Button onClick={goToToday} variant='outline'>
						{t('shell.header.today')}
					</Button>
					<Button aria-label={t(`shell.header.previous.${view}`)} onClick={goToPrevious} size='icon' variant='ghost'>
						<ChevronLeftIcon />
					</Button>
					<Button aria-label={t(`shell.header.next.${view}`)} onClick={goToNext} size='icon' variant='ghost'>
						<ChevronRightIcon />
					</Button>
				</nav>
				<h1 aria-live='polite' className='min-w-0 truncate font-heading text-xl font-semibold first-letter:uppercase md:text-2xl'>
					{date !== null && formatMonthYear(toUtcDate(date), { language: resolveLanguage([i18n.language]), timeZone: 'UTC' })}
				</h1>
			</div>
			<div className='flex items-center gap-2'>
				<ToggleGroup
					aria-label={t('shell.views.label')}
					data-tour={TOUR_TARGETS.views}
					onValueChange={([selected]) => {
						// Pressing the active view again empties the group; keep the current view instead.
						if (isCalendarView(selected)) setView(selected);
					}}
					value={[view]}
					variant='outline'
				>
					{CALENDAR_VIEWS.map(option => (
						<ToggleGroupItem key={option} value={option}>
							{t(`shell.views.${option}`)}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				<Tooltip>
					<TooltipTrigger render={<Button aria-label={t('settings.open')} data-tour={TOUR_TARGETS.settings} onClick={() => openSettings()} size='icon' variant='ghost' />}>
						<SettingsIcon />
					</TooltipTrigger>
					<TooltipContent>
						{t('settings.open')} <ShortcutKeys keys={[SHORTCUTS.openSettings.keys]} />
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger render={<Button aria-expanded={panelOpen} aria-label={t('shell.panel.toggle')} onClick={onTogglePanel} size='icon' variant='ghost' />}>
						<PanelRightIcon />
					</TooltipTrigger>
					<TooltipContent>
						{t('shell.panel.toggle')} <ShortcutKeys keys={[SHORTCUTS.togglePanel.keys]} />
					</TooltipContent>
				</Tooltip>
			</div>
		</header>
	);
}
