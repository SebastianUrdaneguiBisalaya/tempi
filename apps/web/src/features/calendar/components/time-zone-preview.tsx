'use client';

import { resolveLanguage } from '@tempi/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { timeZoneLabel } from '@/lib/countries';

type TimeZonePreviewProps = {
	/** The header's own button; it becomes the trigger and keeps its props. */
	children: ReactElement;
	description: string | null;
	label: string;
	timeZone: string;
};

/** The full, uncut name of a time zone column, on hover or click: the header truncates long names. */
export function TimeZonePreview({ children, description, label, timeZone }: TimeZonePreviewProps) {
	const { i18n } = useTranslation();
	const language = resolveLanguage([i18n.language]);

	return (
		<Popover>
			<PopoverTrigger delay={300} openOnHover render={children} />
			<PopoverContent align='start' className='w-64 gap-1' side='right' sideOffset={8}>
				<PopoverHeader>
					<PopoverTitle>{description === null ? label : `${label} · ${description}`}</PopoverTitle>
					<PopoverDescription>{timeZoneLabel(timeZone, language)}</PopoverDescription>
				</PopoverHeader>
			</PopoverContent>
		</Popover>
	);
}
