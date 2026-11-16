'use client';

import { type OnboardingInput, THEMES } from '@tempi/core';
import { useController, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { QuestionnaireChoice, QuestionnaireChoiceDescription, QuestionnaireChoices, QuestionnaireDescription, QuestionnaireItem, QuestionnaireTitle } from '@/components/ui/questionnaire';
import { useAppearancePreview } from '@/providers/appearance-preview-provider';

export function ThemeStep() {
	const { t } = useTranslation();
	const { control } = useFormContext<OnboardingInput>();
	const { field, fieldState } = useController({ control, name: 'theme' });
	const { preview, setPreview } = useAppearancePreview();

	return (
		<QuestionnaireItem invalid={fieldState.invalid} name='theme' required>
			<QuestionnaireTitle>{t('onboarding.theme.title')}</QuestionnaireTitle>
			<QuestionnaireDescription>{t('onboarding.theme.description')}</QuestionnaireDescription>
			<QuestionnaireChoices>
				{THEMES.map(theme => (
					<QuestionnaireChoice
						checked={field.value === theme}
						key={theme}
						onChange={() => {
							field.onChange(theme);
							setPreview({ ...preview, theme });
						}}
						value={theme}
					>
						{t(`onboarding.theme.options.${theme}`)}
						{theme === 'system' && <QuestionnaireChoiceDescription>{t('onboarding.theme.systemDescription')}</QuestionnaireChoiceDescription>}
					</QuestionnaireChoice>
				))}
			</QuestionnaireChoices>
			<FormFieldError error={fieldState.error} />
		</QuestionnaireItem>
	);
}
