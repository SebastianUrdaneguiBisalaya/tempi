'use client';

import { useShortcuts } from '@usehotkeys/react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { isListedAction, LISTED_SHORTCUTS, SHORTCUT_GROUPS } from '../shortcuts';
import { ShortcutKeys } from './shortcut-keys';

/** Every shortcut, the calendar grid's included, grouped, with its keys. */
export function ShortcutList() {
	const { t } = useTranslation();
	const id = useId();
	const shortcuts = useShortcuts();

	return (
		<div className='flex flex-col gap-4'>
			{SHORTCUT_GROUPS.map(group => {
				const inGroup = shortcuts.filter(shortcut => isListedAction(shortcut.action) && LISTED_SHORTCUTS[shortcut.action].group === group);
				if (inGroup.length === 0) return null;
				const headingId = `${id}-${group}`;
				return (
					<section aria-labelledby={headingId} className='flex flex-col gap-1.5' key={group}>
						<h3 className='text-xs font-medium text-muted-foreground' id={headingId}>
							{t(`shortcuts.groups.${group}`)}
						</h3>
						<dl className='flex flex-col gap-1'>
							{inGroup.map(({ action, keys }) => (
								<div className='flex items-center justify-between gap-3' key={action}>
									<dt className='min-w-0 truncate'>{isListedAction(action) && t(`shortcuts.actions.${action}`)}</dt>
									<dd className='shrink-0'>
										<ShortcutKeys keys={keys} />
									</dd>
								</div>
							))}
						</dl>
					</section>
				);
			})}
		</div>
	);
}
