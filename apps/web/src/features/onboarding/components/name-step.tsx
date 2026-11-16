'use client';

import type { OnboardingInput } from '@tempi/core';
import { useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { QuestionnaireDescription, QuestionnaireInput, QuestionnaireItem, QuestionnaireTitle } from '@/components/ui/questionnaire';
import { NameFields } from '@/features/profile/components/name-fields';

export function NameStep() {
	const { t } = useTranslation();
	const { errors } = useFormState<OnboardingInput>({ name: ['firstName', 'lastName'] });

	return (
		<QuestionnaireItem invalid={errors.firstName !== undefined || errors.lastName !== undefined} name='name' required>
			<QuestionnaireTitle>{t('onboarding.name.title')}</QuestionnaireTitle>
			<QuestionnaireDescription>{t('onboarding.name.description')}</QuestionnaireDescription>
			<NameFields input={QuestionnaireInput} />
		</QuestionnaireItem>
	);
}
