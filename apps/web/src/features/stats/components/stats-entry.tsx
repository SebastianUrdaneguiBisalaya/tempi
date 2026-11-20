'use client';

import { ChartColumnIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useStats } from './stats-provider';

/** Opens the time stats drawer from the sidebar; `onOpen` lets a sidebar shown as a drawer close first. */
export function StatsEntry({ onOpen }: { onOpen?: () => void }) {
	const { t } = useTranslation();
	const { openStats } = useStats();
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					onClick={() => {
						onOpen?.();
						openStats();
					}}
				>
					<ChartColumnIcon aria-hidden='true' />
					<span>{t('stats.title')}</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
