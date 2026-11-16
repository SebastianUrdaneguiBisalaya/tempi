'use client';

import type { OnboardingInput } from '@tempi/core';
import { useState } from 'react';
import { useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { QuestionnaireDescription, QuestionnaireItem, QuestionnaireTitle } from '@/components/ui/questionnaire';
import { AvatarField } from '@/features/profile/components/avatar-field';

export function AvatarStep() {
	const { t } = useTranslation();
	const { errors } = useFormState<OnboardingInput>({ name: 'avatar' });
	const [unreadable, setUnreadable] = useState(false);

	return (
		<QuestionnaireItem invalid={errors.avatar !== undefined || unreadable} name='avatar'>
			<QuestionnaireTitle>{t('onboarding.avatar.title')}</QuestionnaireTitle>
			<QuestionnaireDescription>{t('onboarding.avatar.description')}</QuestionnaireDescription>
			<AvatarField onUnreadableChange={setUnreadable} />
		</QuestionnaireItem>
	);
}
