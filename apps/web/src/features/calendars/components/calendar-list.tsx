'use client';

import { type Calendar, pickCalendarColor } from '@tempi/core';
import { DownloadIcon, EyeIcon, EyeOffIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { type ComponentType, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { cn } from '@/lib/utils';
import { useSetCalendarVisible, useUpdateCalendar } from '../hooks/use-calendar-mutations';
import { useExportCalendars, useImportCalendar } from '../hooks/use-calendar-transfer';
import { CalendarDialog } from './calendar-dialog';
import { DeleteCalendarDialog } from './delete-calendar-dialog';

type RowAction = { destructive?: boolean; icon: ComponentType; label: string; run: () => void };

/** The sidebar's calendars: show or hide each one's events, and create, edit, make default, import into, export or delete them. */
export function CalendarList() {
	const { t } = useTranslation();
	const { data: calendars } = useCalendars();
	const setVisible = useSetCalendarVisible();
	const updateCalendar = useUpdateCalendar();
	const importCalendar = useImportCalendar();
	const exportCalendars = useExportCalendars();
	const [editing, setEditing] = useState<{ calendar: Calendar | null; color: string } | null>(null);
	const [deleting, setDeleting] = useState<Calendar | null>(null);

	if (calendars === undefined) return null;

	const actionsOf = (calendar: Calendar): RowAction[] => [
		{ icon: PencilIcon, label: t('actions.edit'), run: () => setEditing({ calendar, color: calendar.color }) },
		{ icon: DownloadIcon, label: t('calendars.import'), run: () => importCalendar.mutate(calendar.id) },
		{ icon: UploadIcon, label: t('calendars.export'), run: () => exportCalendars.mutate(calendar.id) },
		...(calendar.isDefault
			? []
			: [
					{ icon: StarIcon, label: t('calendars.makeDefault'), run: () => updateCalendar.mutate({ id: calendar.id, patch: { isDefault: true } }) },
					{ destructive: true, icon: Trash2Icon, label: t('actions.delete'), run: () => setDeleting(calendar) },
				]),
	];

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t('calendars.title')}</SidebarGroupLabel>
			<SidebarGroupAction
				aria-label={t('calendars.add')}
				onClick={() => setEditing({ calendar: null, color: pickCalendarColor(calendars.map(calendar => calendar.color)) })}
				title={t('calendars.add')}
			>
				<PlusIcon />
			</SidebarGroupAction>
			<SidebarGroupContent>
				<SidebarMenu>
					{calendars.map(calendar => {
						const actions = actionsOf(calendar);
						const VisibilityIcon = calendar.isVisible ? EyeIcon : EyeOffIcon;
						return (
							<SidebarMenuItem key={calendar.id}>
								<ContextMenu>
									<ContextMenuTrigger
										render={
											<SidebarMenuButton
												aria-pressed={calendar.isVisible}
												className='pr-8'
												onClick={() => setVisible.mutate({ id: calendar.id, isVisible: !calendar.isVisible })}
												title={t(calendar.isVisible ? 'calendars.hide' : 'calendars.show', { name: calendar.name })}
											/>
										}
									>
										<span
											aria-hidden
											className='size-3 shrink-0 rounded-sm border-2'
											style={{ backgroundColor: calendar.isVisible ? calendar.color : 'transparent', borderColor: calendar.color }}
										/>
										<span className={cn('truncate', !calendar.isVisible && 'text-muted-foreground')}>{calendar.name}</span>
										{calendar.isDefault && <span className='shrink-0 text-[0.65rem] text-muted-foreground'>{t('calendars.default')}</span>}
										<VisibilityIcon aria-hidden className='ml-auto text-muted-foreground' />
									</ContextMenuTrigger>
									<ContextMenuContent>
										{actions.map(action => (
											<ContextMenuItem key={action.label} onClick={action.run} variant={action.destructive ? 'destructive' : 'default'}>
												<action.icon />
												{action.label}
											</ContextMenuItem>
										))}
									</ContextMenuContent>
								</ContextMenu>
								<DropdownMenu>
									<DropdownMenuTrigger render={<SidebarMenuAction aria-label={t('calendars.actions', { name: calendar.name })} showOnHover />}>
										<MoreHorizontalIcon />
									</DropdownMenuTrigger>
									<DropdownMenuContent align='start' side='right'>
										{actions.map(action => (
											<DropdownMenuItem key={action.label} onClick={action.run} variant={action.destructive ? 'destructive' : 'default'}>
												<action.icon />
												{action.label}
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
			<CalendarDialog calendar={editing?.calendar ?? null} defaultColor={editing?.color ?? ''} onClose={() => setEditing(null)} open={editing !== null} />
			<DeleteCalendarDialog calendar={deleting} calendars={calendars} onClose={() => setDeleting(null)} />
		</SidebarGroup>
	);
}
