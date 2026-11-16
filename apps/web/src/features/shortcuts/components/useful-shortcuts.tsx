'use client';

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ShortcutList } from './shortcut-list';

/** The right panel's shortcuts section, read from the registry. */
export function UsefulShortcuts() {
	const { t } = useTranslation();
	const headingId = useId();
	return (
		<section aria-labelledby={headingId} className='flex flex-col gap-3 text-xs'>
			<h2 className='font-heading text-sm font-semibold' id={headingId}>
				{t('shortcuts.useful')}
			</h2>
			<ShortcutList />
		</section>
	);
}
