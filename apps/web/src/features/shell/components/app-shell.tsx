'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AssistantDrawer, AssistantEntry } from '@/features/assistant/components/assistant';
import { AssistantProvider } from '@/features/assistant/components/assistant-provider';
import { ShareAvailabilityProvider } from '@/features/availability/components/share-availability-provider';
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
import { UpcomingEvents } from '@/features/events/components/upcoming-events';
import { HolidaySyncWatcher } from '@/features/holidays/components/holiday-sync-watcher';
import { GoogleSyncWatcher } from '@/features/settings/components/google-sync-watcher';
import { SettingsDialogProvider } from '@/features/settings/components/settings-dialog-provider';
import { UpdateWatcher } from '@/features/settings/components/update-watcher';
import { CommandMenu } from '@/features/shortcuts/components/command-menu';
import { ShortcutsDialog } from '@/features/shortcuts/components/shortcuts-dialog';
import { ShortcutsHint } from '@/features/shortcuts/components/shortcuts-hint';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { StatsEntry } from '@/features/stats/components/stats-entry';
import { StatsProvider } from '@/features/stats/components/stats-provider';
import { TourProvider, useTour, useTourLayout } from '@/features/tour/components/tour-provider';
import { TOUR_TARGETS } from '@/features/tour/tour-steps';
import { WeatherEntry } from '@/features/weather/components/weather-card';
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
				<TourProvider>
					<SettingsDialogProvider>
						<GoToDateProvider>
							<ShareAvailabilityProvider>
								<StatsProvider>
									<AssistantProvider>
										<CalendarShortcuts />
										<EventShortcuts />
										<ShowEventRequests />
										<GoogleSyncWatcher />
										<HolidaySyncWatcher />
										<UpdateWatcher />
										<ShellLayout />
										<ShortcutsDialog />
										<CommandMenu />
									</AssistantProvider>
								</StatsProvider>
							</ShareAvailabilityProvider>
						</GoToDateProvider>
					</SettingsDialogProvider>
				</TourProvider>
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
	const [panelExpanded, setPanelExpanded] = useState(true);
	// An open or new event always shows the panel, like the drawer does on narrow windows.
	const panelOpen = panelInline ? panelExpanded || selection !== null : panelDrawerOpen || selection !== null;

	const toggleSidebar = () => (sidebarInline ? setSidebarExpanded(open => !open) : setSidebarDrawerOpen(open => !open));
	useShortcut('toggleSidebar', toggleSidebar);
	const togglePanel = () => {
		if (!panelOpen) return panelInline ? setPanelExpanded(true) : setPanelDrawerOpen(true);
		// Hiding the panel also closes the event shown in it, or the selection would bring it straight back.
		close();
		if (panelInline) setPanelExpanded(false);
		else setPanelDrawerOpen(false);
	};
	useShortcut('togglePanel', togglePanel);
	const tour = useTour();
	useTourLayout({
		reveal: area => {
			let moving = false;
			// The panel shows its default sections (search, upcoming, shortcuts) during the tour.
			if (selection !== null && (area === 'panel' || !panelInline)) {
				close();
				moving = !panelInline;
			}
			if (area === 'sidebar') {
				moving ||= sidebarInline ? !sidebarExpanded : !sidebarDrawerOpen;
				if (sidebarInline) setSidebarExpanded(true);
				else setSidebarDrawerOpen(true);
			} else if (!sidebarInline && sidebarDrawerOpen) {
				moving = true;
				setSidebarDrawerOpen(false);
			}
			if (area === 'panel') {
				moving ||= panelInline ? !panelExpanded : !panelDrawerOpen;
				if (panelInline) setPanelExpanded(true);
				else setPanelDrawerOpen(true);
			} else if (!panelInline && panelDrawerOpen) {
				moving = true;
				setPanelDrawerOpen(false);
			}
			return moving;
		},
		reset: () => {
			setSidebarDrawerOpen(false);
			setPanelDrawerOpen(false);
		},
	});
	// The assistant floats beside its sidebar entry while that is on screen; otherwise it opens as a bottom drawer.
	const assistantAnchored = sidebarInline && sidebarExpanded;
	const panelContent =
		selection === null ? (
			<SearchablePanel footer={<ShortcutsHint />}>
				<UpcomingEvents />
			</SearchablePanel>
		) : (
			<EventPanel />
		);

	return (
		<SidebarProvider className='h-svh min-h-0' onOpenChange={setSidebarExpanded} open={sidebarExpanded}>
			{sidebarInline ? (
				<Sidebar aria-label={t('shell.sidebar.label')} role='complementary'>
					<SidebarContent>
						<SidebarGroup data-tour={TOUR_TARGETS.miniCalendar}>
							<MiniCalendar />
						</SidebarGroup>
						<CalendarList />
					</SidebarContent>
					<SidebarFooter data-tour={TOUR_TARGETS.assistant}>
						<StatsEntry />
						<WeatherEntry />
						<AssistantEntry anchored={sidebarExpanded} />
					</SidebarFooter>
				</Sidebar>
			) : (
				<Drawer
					// During the tour its popover sits outside the drawer: keep the drawer open and the popover usable.
					disablePointerDismissal={tour.active}
					modal={!tour.active}
					onOpenChange={setSidebarDrawerOpen}
					open={sidebarDrawerOpen}
					swipeDirection='left'
				>
					<DrawerContent>
						<DrawerHeader className='sr-only'>
							<DrawerTitle>{t('shell.sidebar.label')}</DrawerTitle>
						</DrawerHeader>
						<SidebarContent>
							<SidebarGroup data-tour={TOUR_TARGETS.miniCalendar}>
								<MiniCalendar />
							</SidebarGroup>
							<CalendarList />
						</SidebarContent>
						<SidebarFooter data-tour={TOUR_TARGETS.assistant}>
							<StatsEntry onOpen={() => setSidebarDrawerOpen(false)} />
							<WeatherEntry />
							<AssistantEntry anchored={false} onOpenDrawer={() => setSidebarDrawerOpen(false)} />
						</SidebarFooter>
					</DrawerContent>
				</Drawer>
			)}
			<SidebarInset className='min-h-0 min-w-0'>
				<AppHeader onTogglePanel={togglePanel} onToggleSidebar={toggleSidebar} panelOpen={panelOpen} sidebarOpen={sidebarInline ? sidebarExpanded : sidebarDrawerOpen} />
				<div className='flex min-h-0 flex-1'>
					<div className='min-w-0 flex-1' data-tour={TOUR_TARGETS.calendar}>
						<CalendarMain />
					</div>
					{panelInline ? (
						panelOpen && (
							<aside aria-label={t('shell.panel.label')} className='w-72 shrink-0 border-l' data-tour={TOUR_TARGETS.panel}>
								{panelContent}
							</aside>
						)
					) : (
						<Drawer
							disablePointerDismissal={tour.active}
							modal={!tour.active}
							onOpenChange={open => {
								if (open) return;
								setPanelDrawerOpen(false);
								close();
							}}
							// Opening or creating an event brings the panel into view on narrow windows.
							open={panelOpen}
							swipeDirection='right'
						>
							<DrawerContent data-tour={TOUR_TARGETS.panel}>
								<DrawerHeader className='sr-only'>
									<DrawerTitle>{t('shell.panel.label')}</DrawerTitle>
								</DrawerHeader>
								{panelContent}
							</DrawerContent>
						</Drawer>
					)}
				</div>
				{!assistantAnchored && <AssistantDrawer />}
			</SidebarInset>
		</SidebarProvider>
	);
}
