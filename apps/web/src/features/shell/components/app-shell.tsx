'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Sidebar, SidebarContent, SidebarGroup, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { CalendarMain } from '@/features/calendar/components/calendar-main';
import { CalendarNavigationProvider } from '@/features/calendar/components/calendar-navigation-provider';
import { CalendarShortcuts } from '@/features/calendar/components/calendar-shortcuts';
import { GoToDateProvider } from '@/features/calendar/components/go-to-date-provider';
import { MiniCalendar } from '@/features/calendar/components/mini-calendar';
import { CalendarList } from '@/features/calendars/components/calendar-list';
import { EventPanel } from '@/features/events/components/event-panel';
import { EventPanelProvider, useEventPanel } from '@/features/events/components/event-panel-provider';
import { SearchablePanel } from '@/features/events/components/event-search';
import { EventShortcuts } from '@/features/events/components/event-shortcuts';
import { ShowEventRequests } from '@/features/events/components/show-event-requests';

import { UpcomingEvent } from '@/features/events/components/upcoming-event';
import { GoogleSyncWatcher } from '@/features/settings/components/google-sync-watcher';
import { SettingsDialogProvider } from '@/features/settings/components/settings-dialog-provider';
import { CommandMenu } from '@/features/shortcuts/components/command-menu';
import { ShortcutsDialog } from '@/features/shortcuts/components/shortcuts-dialog';
import { ShortcutsHint } from '@/features/shortcuts/components/shortcuts-hint';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { useMediaQuery } from '@/hooks/use-media-query';
import { AppHeader } from './app-header';

// Tailwind's `md` and `lg` breakpoints. Below them the sidebar and the right panel move into drawers.
const SIDEBAR_INLINE_QUERY = '(min-width: 48rem)';
const PANEL_INLINE_QUERY = '(min-width: 64rem)';

/** Three-column layout: left sidebar, header over the calendar, right panel (the selected event, or the default sections). */
export function AppShell() {
	return (
		<CalendarNavigationProvider>
			<EventPanelProvider>
				<SettingsDialogProvider>
					<GoToDateProvider>
						<CalendarShortcuts />
						<EventShortcuts />
						<ShowEventRequests />
						<GoogleSyncWatcher />
						<ShellLayout />
						<ShortcutsDialog />
						<CommandMenu />
					</GoToDateProvider>
				</SettingsDialogProvider>
			</EventPanelProvider>
		</CalendarNavigationProvider>
	);
}

function ShellLayout() {
	const { t } = useTranslation();
	const { close, selection } = useEventPanel();
	// The prerender assumes a desktop window, the common case.
	const sidebarInline = useMediaQuery(SIDEBAR_INLINE_QUERY, true);
	const panelInline = useMediaQuery(PANEL_INLINE_QUERY, true);
	const [sidebarExpanded, setSidebarExpanded] = useState(true);
	const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
	const [panelDrawerOpen, setPanelDrawerOpen] = useState(false);

	const toggleSidebar = () => (sidebarInline ? setSidebarExpanded(open => !open) : setSidebarDrawerOpen(open => !open));
	useShortcut('toggleSidebar', toggleSidebar);
	const panelContent =
		selection === null ? (
			<SearchablePanel footer={<ShortcutsHint />}>
				<UpcomingEvent />
			</SearchablePanel>
		) : (
			<EventPanel />
		);

	return (
		<SidebarProvider className='h-svh min-h-0' onOpenChange={setSidebarExpanded} open={sidebarExpanded}>
			{sidebarInline ? (
				<Sidebar aria-label={t('shell.sidebar.label')} role='complementary'>
					<SidebarContent>
						<SidebarGroup>
							<MiniCalendar />
						</SidebarGroup>
						<CalendarList />
					</SidebarContent>
				</Sidebar>
			) : (
				<Drawer onOpenChange={setSidebarDrawerOpen} open={sidebarDrawerOpen} swipeDirection='left'>
					<DrawerContent>
						<DrawerHeader className='sr-only'>
							<DrawerTitle>{t('shell.sidebar.label')}</DrawerTitle>
						</DrawerHeader>
						<SidebarContent>
							<SidebarGroup>
								<MiniCalendar />
							</SidebarGroup>
							<CalendarList />
						</SidebarContent>
					</DrawerContent>
				</Drawer>
			)}
			<SidebarInset className='min-h-0 min-w-0'>
				<AppHeader onOpenPanel={panelInline ? undefined : () => setPanelDrawerOpen(true)} onToggleSidebar={toggleSidebar} sidebarOpen={sidebarInline ? sidebarExpanded : sidebarDrawerOpen} />
				<div className='flex min-h-0 flex-1'>
					<div className='min-w-0 flex-1'>
						<CalendarMain />
					</div>
					{panelInline ? (
						<aside aria-label={t('shell.panel.label')} className='w-72 shrink-0 border-l'>
							{panelContent}
						</aside>
					) : (
						<Drawer
							onOpenChange={open => {
								if (open) return;
								setPanelDrawerOpen(false);
								close();
							}}
							// Opening or creating an event brings the panel into view on narrow windows.
							open={panelDrawerOpen || selection !== null}
							swipeDirection='right'
						>
							<DrawerContent>
								<DrawerHeader className='sr-only'>
									<DrawerTitle>{t('shell.panel.label')}</DrawerTitle>
								</DrawerHeader>
								{panelContent}
							</DrawerContent>
						</Drawer>
					)}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
