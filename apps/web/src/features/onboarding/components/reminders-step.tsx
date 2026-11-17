'use client';

import type { OnboardingInput } from '@tempi/core';
import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { QuestionnaireChoice, QuestionnaireChoiceDescription, QuestionnaireChoices, QuestionnaireDescription, QuestionnaireItem, QuestionnaireTitle } from '@/components/ui/questionnaire';
import { useTestNotification } from '@/features/settings/hooks/use-permissions';

const OPTIONS = [
	{ enabled: true, value: 'on' },
	{ enabled: false, value: 'off' },
] as const;

/**
 * Optional: whether reminders show as notifications. Choosing them sends a test notification, which is what makes
 * macOS ask for permission, so nothing is asked before the user picks it. Skipping keeps them on without asking.
 */
export function RemindersStep() {
	const { t } = useTranslation();
	const { control } = useFormContext<OnboardingInput>();
	const { field } = useController({ control, name: 'notificationsEnabled' });
	const testNotification = useTestNotification();
	// Unanswered until picked, even though the stored default is on: the default isn't a choice the user made.
	const [picked, setPicked] = useState(false);

	return (
		<QuestionnaireItem name='reminders'>
			<QuestionnaireTitle>{t('onboarding.reminders.title')}</QuestionnaireTitle>
			<QuestionnaireDescription>{t('onboarding.reminders.description')}</QuestionnaireDescription>
			<QuestionnaireChoices>
				{OPTIONS.map(({ enabled, value }) => (
					<QuestionnaireChoice
						checked={picked && field.value === enabled}
						key={value}
						onChange={() => {
							// One test notification per switch to "on", not one per click.
							if (enabled && !(picked && field.value)) testNotification.mutate();
							setPicked(true);
							field.onChange(enabled);
						}}
						value={value}
					>
						{t(`onboarding.reminders.options.${value}`)}
						{enabled && <QuestionnaireChoiceDescription>{t('onboarding.reminders.onDescription')}</QuestionnaireChoiceDescription>}
					</QuestionnaireChoice>
				))}
			</QuestionnaireChoices>
		</QuestionnaireItem>
	);
}
