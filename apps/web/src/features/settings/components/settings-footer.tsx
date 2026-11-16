'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** A settings tab's Save button: enabled once something changed, busy while saving. */
export function SettingsFooter({ dirty, saving }: { dirty: boolean; saving: boolean }) {
	const { t } = useTranslation();
	return (
		<div className='flex justify-end border-t pt-3'>
			<Button disabled={!dirty || saving} type='submit'>
				{saving && <Spinner />}
				{t('actions.save')}
			</Button>
		</div>
	);
}
