'use client';

import { InfoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';

/** The stats that come with an explanation, each under `stats.info.<id>`. */
export type StatInfoId = 'averageDuration' | 'busiestDay' | 'byCalendar' | 'events' | 'focus' | 'heatmap' | 'nextWeek' | 'occupancy' | 'recurrence' | 'status' | 'top' | 'total' | 'venue' | 'weekly';

const PARTS = ['what', 'read', 'how'] as const;

/** An info button that explains one stat on hover or click: what it shows, how to read it, how it is calculated. */
export function StatInfo({ id, title }: { id: StatInfoId; title: string }) {
	const { t } = useTranslation();
	return (
		<Popover>
			<PopoverTrigger
				aria-label={t('stats.info.label', { title })}
				className='inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
				delay={200}
				openOnHover
				type='button'
			>
				<InfoIcon aria-hidden='true' className='size-3.5' />
			</PopoverTrigger>
			<PopoverContent align='start' className='gap-3'>
				<PopoverHeader>
					<PopoverTitle>{title}</PopoverTitle>
				</PopoverHeader>
				<dl className='flex flex-col gap-2'>
					{PARTS.map(part => (
						<div className='flex flex-col gap-0.5' key={part}>
							<dt className='font-medium'>{t(`stats.info.heading.${part}`)}</dt>
							<dd className='text-muted-foreground'>{t(`stats.info.${id}.${part}`)}</dd>
						</div>
					))}
				</dl>
			</PopoverContent>
		</Popover>
	);
}
