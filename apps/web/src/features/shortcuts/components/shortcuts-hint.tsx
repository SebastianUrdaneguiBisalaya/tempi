'use client';

import { useTranslation } from 'react-i18next';
import { SHORTCUTS } from '../shortcuts';
import { ShortcutKeys } from './shortcut-keys';

/** A quiet pointer to the shortcuts dialog; the full list lives in settings. */
export function ShortcutsHint() {
	const { t } = useTranslation();
	return (
		<p className='flex w-full items-center justify-between gap-1.5 text-xs text-muted-foreground'>
			{t('shortcuts.hint')} <ShortcutKeys keys={[SHORTCUTS.showShortcuts.keys]} />
		</p>
	);
}
