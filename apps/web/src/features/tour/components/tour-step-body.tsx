'use client';

import { useTranslation } from 'react-i18next';
import { ShortcutKeys } from '@/features/shortcuts/components/shortcut-keys';
import { shortcutKeysOf } from '@/features/shortcuts/shortcuts';
import { TOUR_STEPS, type TourStepId } from '../tour-steps';

/** A step's text and the shortcuts it teaches, with their keys from the registry. */
export function TourStepBody({ googleConnected, step }: { googleConnected: boolean; step: TourStepId }) {
	const { t } = useTranslation();
	const { shortcuts } = TOUR_STEPS[step];
	const description = step === 'google' && !googleConnected ? t('tour.steps.google.notConnected') : t(`tour.steps.${step}.description`);

	return (
		<div className='flex flex-col gap-2'>
			<p>{description}</p>
			{shortcuts.length > 0 && (
				<ul className='flex flex-col gap-1 text-popover-foreground'>
					{shortcuts.map(action => (
						<li className='flex items-center justify-between gap-2' key={action}>
							<span>{t(`shortcuts.actions.${action}`)}</span>
							<ShortcutKeys keys={shortcutKeysOf(action)} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
