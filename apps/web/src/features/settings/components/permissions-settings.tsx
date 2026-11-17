'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type OsPermission, type OsPermissionStatus, type Settings, settingsValuesSchema, zodErrorKeyMap } from '@tempi/core';
import { ExternalLinkIcon } from 'lucide-react';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { useSaveSettings } from '@/features/settings/hooks/use-settings';
import { useOpenSystemSettings, usePermissionStatus } from '../hooks/use-permissions';
import { SettingsFooter } from './settings-footer';

const permissionsSchema = settingsValuesSchema.pick({ microphoneEnabled: true, notificationsEnabled: true });
type PermissionsValues = z.input<typeof permissionsSchema>;

const valuesOf = (settings: Settings): PermissionsValues => ({ microphoneEnabled: settings.microphoneEnabled, notificationsEnabled: settings.notificationsEnabled });

const SWITCHES = [
	{ name: 'notificationsEnabled', permission: 'notifications' },
	{ name: 'microphoneEnabled', permission: 'microphone' },
] as const satisfies readonly { name: keyof PermissionsValues; permission: OsPermission }[];

/** The OS state of one permission, and a way to its system page when the user may need to change it there. */
function OsStatus({ permission, status }: { permission: OsPermission; status: OsPermissionStatus | undefined }) {
	const { t } = useTranslation();
	const openSystemSettings = useOpenSystemSettings();
	if (status === undefined) return null;
	// Tempi can't read whether notifications are allowed (`unknown`), so their page is always offered.
	const offerSettings = status.canOpenSettings && (status.state === 'denied' || status.state === 'unknown');
	return (
		<div className='flex flex-col items-start gap-2'>
			<p className={status.state === 'denied' ? 'text-destructive' : 'text-muted-foreground'}>{t(`settings.permissions.state.${status.state}`)}</p>
			{offerSettings && (
				<Button disabled={openSystemSettings.isPending} onClick={() => openSystemSettings.mutate(permission)} size='sm' type='button' variant='outline'>
					<ExternalLinkIcon aria-hidden />
					{t('settings.permissions.openSystemSettings')}
				</Button>
			)}
		</div>
	);
}

/** Whether Tempi shows reminders and may use the microphone, next to what the OS allows for each. */
export function PermissionsSettings({ settings }: { settings: Settings }) {
	const { t } = useTranslation();
	const id = useId();
	const saveSettings = useSaveSettings();
	const { data: status } = usePermissionStatus();
	const form = useForm<PermissionsValues>({ defaultValues: valuesOf(settings), resolver: zodResolver(permissionsSchema, { error: zodErrorKeyMap }) });

	const submit = form.handleSubmit(values => saveSettings.mutate(values, { onSuccess: saved => form.reset(valuesOf(saved)) }));

	return (
		<form className='flex flex-col gap-6' noValidate onSubmit={submit}>
			<div className='flex flex-col gap-1'>
				<h3 className='font-heading text-sm font-semibold'>{t('settings.permissions.title')}</h3>
				<p className='text-muted-foreground'>{t('settings.permissions.description')}</p>
			</div>
			<FieldGroup className='gap-6'>
				{SWITCHES.map(({ name, permission }) => (
					<Controller
						control={form.control}
						key={name}
						name={name}
						render={({ field }) => (
							<div className='flex flex-col gap-2'>
								<Field orientation='horizontal'>
									<FieldContent>
										<FieldLabel htmlFor={`${id}-${name}`}>{t(`settings.permissions.${name}`)}</FieldLabel>
										<FieldDescription>{t(`settings.permissions.${name}Description`)}</FieldDescription>
									</FieldContent>
									<Switch checked={field.value} id={`${id}-${name}`} onCheckedChange={checked => field.onChange(checked)} ref={field.ref} />
								</Field>
								<OsStatus permission={permission} status={status?.[permission]} />
							</div>
						)}
					/>
				))}
			</FieldGroup>
			<SettingsFooter dirty={form.formState.isDirty} saving={saveSettings.isPending} />
		</form>
	);
}
