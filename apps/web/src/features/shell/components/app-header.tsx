'use client';

import { CALENDAR_VIEWS, isCalendarView, resolveLanguage } from '@tempi/core';
import { ChevronLeftIcon, ChevronRightIcon, PanelLeftIcon, PanelRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { formatMonthYear } from '@/lib/date-format';
import { toUtcDate } from '@/lib/plain-date';
import { SIDEBAR_HOTKEY } from '../shell-hotkeys';
import { UserAvatar } from './user-avatar';

type AppHeaderProps = {
	/** Shown only when the right panel is collapsed into a drawer. */
	onOpenPanel?: () => void;
	onToggleSidebar: () => void;
	sidebarOpen: boolean;
};

export function AppHeader({ onOpenPanel, onToggleSidebar, sidebarOpen }: AppHeaderProps) {
	const { i18n, t } = useTranslation();
	const { date, goToNext, goToPrevious, goToToday, setView, view } = useCalendarNavigation();

	return (
		<header className='flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2'>
			<div className='flex min-w-0 flex-1 items-center gap-2'>
				<Tooltip>
					<TooltipTrigger render={<Button aria-expanded={sidebarOpen} aria-label={t('shell.sidebar.toggle')} onClick={onToggleSidebar} size='icon' variant='ghost' />}>
						<PanelLeftIcon />
					</TooltipTrigger>
					<TooltipContent>
						{t('shell.sidebar.toggle')} <Kbd>{SIDEBAR_HOTKEY}</Kbd>
					</TooltipContent>
				</Tooltip>
				<UserAvatar />
				<nav aria-label={t('shell.header.label')} className='flex items-center gap-1'>
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
				{onOpenPanel && (
					<Button aria-label={t('shell.panel.open')} onClick={onOpenPanel} size='icon' variant='ghost'>
						<PanelRightIcon />
					</Button>
				)}
			</div>
		</header>
	);
}
