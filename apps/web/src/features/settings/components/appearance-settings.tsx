'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LANGUAGES, type Settings, settingsValuesSchema, THEMES, UI_SOUNDS, zodErrorKeyMap } from '@tempi/core';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormFieldError } from '@/components/form-field-error';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSaveSettings } from '@/features/settings/hooks/use-settings';
import { previewSound } from '@/features/sounds/sounds';
import { nativeLanguageName } from '@/lib/language-name';
import { useAppearancePreview } from '@/providers/appearance-preview-provider';
import { showFieldErrors } from './field-errors';
import { SettingsFooter } from './settings-footer';

const appearanceSchema = settingsValuesSchema.pick({ language: true, sound: true, soundsEnabled: true, theme: true });
type AppearanceValues = z.input<typeof appearanceSchema>;

const FIELDS = ['language', 'sound', 'soundsEnabled', 'theme'] as const satisfies readonly (keyof AppearanceValues)[];
const isField = (field: string): field is (typeof FIELDS)[number] => FIELDS.some(name => name === field);

const valuesOf = (settings: Settings): AppearanceValues => ({
	language: settings.language,
	sound: settings.sound,
	soundsEnabled: settings.soundsEnabled,
	theme: settings.theme,
});

/** Theme, language and button sounds. A choice previews at once; Save keeps it, closing the dialog drops it. */
export function AppearanceSettings({ settings }: { settings: Settings }) {
	const { t } = useTranslation();
	const id = useId();
	const { preview, setPreview } = useAppearancePreview();
	const saveSettings = useSaveSettings();
	const soundItems = UI_SOUNDS.map(sound => ({ label: t(`settings.appearance.sounds.${sound}`), value: sound }));
	const form = useForm<AppearanceValues>({
		defaultValues: valuesOf(settings),
		resolver: zodResolver(appearanceSchema, { error: zodErrorKeyMap }),
	});

	const soundsEnabled = form.watch('soundsEnabled');

	const submit = form.handleSubmit(values =>
		saveSettings.mutate(values, {
			onError: error => showFieldErrors(error, form.setError, isField),
			onSuccess: saved => {
				form.reset(valuesOf(saved));
				setPreview({});
			},
		})
	);

	return (
		<form className='flex flex-col gap-6' noValidate onSubmit={submit}>
			<Controller
				control={form.control}
				name='theme'
				render={({ field, fieldState }) => (
					<FieldSet>
						<FieldLegend>{t('settings.appearance.theme')}</FieldLegend>
						<RadioGroup
							onValueChange={value => {
								const theme = THEMES.find(option => option === value);
								if (theme === undefined) return;
								field.onChange(theme);
								setPreview({ ...preview, theme });
							}}
							required
							value={field.value}
						>
							{THEMES.map(theme => (
								<div className='flex items-center gap-2' key={theme}>
									<RadioGroupItem id={`${id}-theme-${theme}`} value={theme} />
									<FieldLabel className='font-normal' htmlFor={`${id}-theme-${theme}`}>
										{t(`onboarding.theme.options.${theme}`)}
									</FieldLabel>
								</div>
							))}
						</RadioGroup>
						<FormFieldError error={fieldState.error} />
					</FieldSet>
				)}
			/>
			<Controller
				control={form.control}
				name='language'
				render={({ field, fieldState }) => (
					<FieldSet>
						<FieldLegend>{t('settings.appearance.language')}</FieldLegend>
						<RadioGroup
							onValueChange={value => {
								const language = LANGUAGES.find(option => option === value);
								if (language === undefined) return;
								field.onChange(language);
								setPreview({ ...preview, language });
							}}
							required
							value={field.value}
						>
							{LANGUAGES.map(language => (
								<div className='flex items-center gap-2' key={language}>
									<RadioGroupItem id={`${id}-language-${language}`} value={language} />
									<FieldLabel className='font-normal' htmlFor={`${id}-language-${language}`} lang={language}>
										{nativeLanguageName(language)}
									</FieldLabel>
								</div>
							))}
						</RadioGroup>
						<FormFieldError error={fieldState.error} />
					</FieldSet>
				)}
			/>
			<Controller
				control={form.control}
				name='soundsEnabled'
				render={({ field }) => (
					<Field orientation='horizontal'>
						<FieldContent>
							<FieldLabel htmlFor={`${id}-sounds-enabled`}>{t('settings.appearance.soundsEnabled')}</FieldLabel>
							<FieldDescription>{t('settings.appearance.soundsEnabledDescription')}</FieldDescription>
						</FieldContent>
						<Switch checked={field.value} id={`${id}-sounds-enabled`} onCheckedChange={checked => field.onChange(checked)} ref={field.ref} />
					</Field>
				)}
			/>
			<Controller
				control={form.control}
				name='sound'
				render={({ field, fieldState }) => (
					<Field data-disabled={!soundsEnabled || undefined} data-invalid={fieldState.invalid || undefined}>
						<FieldLabel htmlFor={`${id}-sound`}>{t('settings.appearance.sound')}</FieldLabel>
						<Select
							disabled={!soundsEnabled}
							items={soundItems}
							onValueChange={value => {
								const sound = UI_SOUNDS.find(option => option === value);
								if (sound === undefined) return;
								field.onChange(sound);
								previewSound(sound);
							}}
							required
							value={field.value}
						>
							<SelectTrigger className='w-full sm:w-56' id={`${id}-sound`} ref={field.ref}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{soundItems.map(item => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FormFieldError error={fieldState.error} />
					</Field>
				)}
			/>
			<SettingsFooter dirty={form.formState.isDirty} saving={saveSettings.isPending} />
		</form>
	);
}
