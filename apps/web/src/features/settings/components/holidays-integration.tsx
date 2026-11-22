'use client';

import { FlagIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useSaveSettings, useSettings } from '../hooks/use-settings';

const NAGER_DATE_URL = 'https://date.nager.at';

/** Turns the public holidays of the profile's country on or off; off deletes the holiday events it added. */
export function HolidaysIntegration() {
	const { t } = useTranslation();
	const id = useId();
	const { data: settings } = useSettings();
	const save = useSaveSettings();
	if (settings === undefined) return null;

	return (
		<section aria-labelledby={`${id}-title`}>
			<Card size='sm'>
				<CardHeader>
					<div className='flex items-center gap-3'>
						<FlagIcon aria-hidden className='size-8 shrink-0 text-muted-foreground' />
						<div className='flex min-w-0 flex-col gap-0.5'>
							<CardTitle>
								<h3 id={`${id}-title`}>{t('settings.integrations.holidays.title')}</h3>
							</CardTitle>
							<CardDescription>{t('settings.integrations.holidays.description')}</CardDescription>
						</div>
					</div>
					<CardAction>
						<Switch
							aria-label={t('settings.integrations.holidays.enabled')}
							checked={settings.holidaysEnabled}
							disabled={save.isPending}
							onCheckedChange={checked => save.mutate({ holidaysEnabled: checked })}
						/>
					</CardAction>
				</CardHeader>
				<CardContent className='flex flex-col items-start gap-4'>
					<p className='text-muted-foreground'>{t('settings.integrations.holidays.privacy')}</p>
					{/* Opens in the system browser: the main process sends new-window links there. */}
					<a className='rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline' href={NAGER_DATE_URL} rel='noreferrer' target='_blank'>
						{t('settings.integrations.holidays.credit')}
					</a>
				</CardContent>
			</Card>
		</section>
	);
}
