'use client';

import type { OnboardingInput } from '@tempi/core';
import { useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { QuestionnaireDescription, QuestionnaireItem, QuestionnaireTitle } from '@/components/ui/questionnaire';
import { LocationFields } from '@/features/profile/components/location-fields';

export function LocationStep() {
	const { t } = useTranslation();
	const { errors } = useFormState<OnboardingInput>({ name: ['country', 'timeZone'] });

	return (
		<QuestionnaireItem invalid={errors.country !== undefined || errors.timeZone !== undefined} name='location' required>
			<QuestionnaireTitle>{t('onboarding.location.title')}</QuestionnaireTitle>
			<QuestionnaireDescription>{t('onboarding.location.description')}</QuestionnaireDescription>
			<LocationFields />
		</QuestionnaireItem>
	);
}
