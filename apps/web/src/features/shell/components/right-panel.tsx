'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';

/** Right column: a search field on top, stacked sections that take the remaining height, and an optional footer pinned at the bottom. */
export function RightPanel({ children, footer, search }: { children?: ReactNode; footer?: ReactNode; search?: ReactNode }) {
	const { t } = useTranslation();
	return (
		<div className='flex h-full min-h-0 flex-col'>
			<div aria-label={t('shell.panel.search')} className='flex min-h-12 items-center border-b px-3 py-2' role='search'>
				{search}
			</div>
			<ScrollArea className='min-h-0 flex-1'>
				<div className='flex flex-col gap-4 p-3'>{children}</div>
			</ScrollArea>
			{footer !== undefined && <div className='px-3 py-2'>{footer}</div>}
		</div>
	);
}
