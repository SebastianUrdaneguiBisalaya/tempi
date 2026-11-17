'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LANGUAGES, type Settings, settingsValuesSchema, THEMES, zodErrorKeyMap } from '@tempi/core';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormFieldError } from '@/components/form-field-error';
import { FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSaveSettings } from '@/features/settings/hooks/use-settings';
import { nativeLanguageName } from '@/lib/language-name';
import { useAppearancePreview } from '@/providers/appearance-preview-provider';
import { showFieldErrors } from './field-errors';
import { SettingsFooter } from './settings-footer';

const appearanceSchema = settingsValuesSchema.pick({ language: true, theme: true });
type AppearanceValues = z.input<typeof appearanceSchema>;

const isField = (field: string): field is keyof AppearanceValues => field === 'language' || field === 'theme';

/** Theme and language. A choice previews at once; Save keeps it, closing the dialog drops it. */
export function AppearanceSettings({ settings }: { settings: Settings }) {
	const { t } = useTranslation();
	const id = useId();
	const { preview, setPreview } = useAppearancePreview();
	const saveSettings = useSaveSettings();
	const form = useForm<AppearanceValues>({
		defaultValues: { language: settings.language, theme: settings.theme },
		resolver: zodResolver(appearanceSchema, { error: zodErrorKeyMap }),
	});

	const submit = form.handleSubmit(values =>
		saveSettings.mutate(values, {
			onError: error => showFieldErrors(error, form.setError, isField),
			onSuccess: saved => {
				form.reset({ language: saved.language, theme: saved.theme });
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
			<SettingsFooter dirty={form.formState.isDirty} saving={saveSettings.isPending} />
		</form>
	);
}
