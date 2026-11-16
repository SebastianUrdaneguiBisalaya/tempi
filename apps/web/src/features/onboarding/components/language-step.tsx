'use client';

import { LANGUAGES, type Language, type OnboardingInput } from '@tempi/core';
import { useController, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { QuestionnaireChoice, QuestionnaireChoices, QuestionnaireDescription, QuestionnaireItem, QuestionnaireTitle } from '@/components/ui/questionnaire';
import { useAppearancePreview } from '@/providers/appearance-preview-provider';

/** Each language in its own words ("English", "Español"), so it's recognizable whatever the current UI language. */
const nativeName = (language: Language): string => {
	const name = new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language;
	return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
};

export function LanguageStep() {
	const { t } = useTranslation();
	const { control } = useFormContext<OnboardingInput>();
	const { field, fieldState } = useController({ control, name: 'language' });
	const { preview, setPreview } = useAppearancePreview();

	return (
		<QuestionnaireItem invalid={fieldState.invalid} name='language' required>
			<QuestionnaireTitle>{t('onboarding.language.title')}</QuestionnaireTitle>
			<QuestionnaireDescription>{t('onboarding.language.description')}</QuestionnaireDescription>
			<QuestionnaireChoices>
				{LANGUAGES.map(language => (
					<QuestionnaireChoice
						checked={field.value === language}
						key={language}
						lang={language}
						onChange={() => {
							field.onChange(language);
							setPreview({ ...preview, language });
						}}
						value={language}
					>
						{nativeName(language)}
					</QuestionnaireChoice>
				))}
			</QuestionnaireChoices>
			<FormFieldError error={fieldState.error} />
		</QuestionnaireItem>
	);
}
