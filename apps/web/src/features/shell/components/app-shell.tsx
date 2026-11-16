'use client';

import { useHotkeys } from '@usehotkeys/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { CalendarNavigationProvider } from '@/features/calendar/components/calendar-navigation-provider';
import { useMediaQuery } from '@/hooks/use-media-query';
import { SIDEBAR_HOTKEY } from '../shell-hotkeys';
import { AppHeader } from './app-header';
import { RightPanel } from './right-panel';

// Tailwind's `md` and `lg` breakpoints. Below them the sidebar and the right panel move into drawers.
const SIDEBAR_INLINE_QUERY = '(min-width: 48rem)';
const PANEL_INLINE_QUERY = '(min-width: 64rem)';

/** Three-column layout: left sidebar, header over the calendar, right panel. The calendar grid comes later. */
export function AppShell() {
	const { t } = useTranslation();
	// The prerender assumes a desktop window, the common case.
	const sidebarInline = useMediaQuery(SIDEBAR_INLINE_QUERY, true);
	const panelInline = useMediaQuery(PANEL_INLINE_QUERY, true);
	const [sidebarExpanded, setSidebarExpanded] = useState(true);
	const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
	const [panelDrawerOpen, setPanelDrawerOpen] = useState(false);

	const toggleSidebar = () => (sidebarInline ? setSidebarExpanded(open => !open) : setSidebarDrawerOpen(open => !open));
	useHotkeys(SIDEBAR_HOTKEY, toggleSidebar, { label: 'Toggle sidebar', layout: 'physical' });

	return (
		<CalendarNavigationProvider>
			<SidebarProvider className='h-svh min-h-0' onOpenChange={setSidebarExpanded} open={sidebarExpanded}>
				{sidebarInline ? (
					<Sidebar aria-label={t('shell.sidebar.label')} role='complementary'>
						<SidebarContent />
					</Sidebar>
				) : (
					<Drawer onOpenChange={setSidebarDrawerOpen} open={sidebarDrawerOpen} swipeDirection='left'>
						<DrawerContent>
							<DrawerHeader className='sr-only'>
								<DrawerTitle>{t('shell.sidebar.label')}</DrawerTitle>
							</DrawerHeader>
							<SidebarContent />
						</DrawerContent>
					</Drawer>
				)}
				<SidebarInset className='min-h-0 min-w-0'>
					<AppHeader
						onOpenPanel={panelInline ? undefined : () => setPanelDrawerOpen(true)}
						onToggleSidebar={toggleSidebar}
						sidebarOpen={sidebarInline ? sidebarExpanded : sidebarDrawerOpen}
					/>
					<div className='flex min-h-0 flex-1'>
						<div className='min-w-0 flex-1' />
						{panelInline ? (
							<aside aria-label={t('shell.panel.label')} className='w-72 shrink-0 border-l'>
								<RightPanel />
							</aside>
						) : (
							<Drawer onOpenChange={setPanelDrawerOpen} open={panelDrawerOpen} swipeDirection='right'>
								<DrawerContent>
									<DrawerHeader className='sr-only'>
										<DrawerTitle>{t('shell.panel.label')}</DrawerTitle>
									</DrawerHeader>
									<RightPanel />
								</DrawerContent>
							</Drawer>
						)}
					</div>
				</SidebarInset>
			</SidebarProvider>
		</CalendarNavigationProvider>
	);
}
