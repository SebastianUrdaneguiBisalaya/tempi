'use client';

import type { OnboardingInput } from '@tempi/core';
import { useId } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { QuestionnaireDescription, QuestionnaireInput, QuestionnaireItem, QuestionnaireTitle } from '@/components/ui/questionnaire';

const NAME_FIELDS = [
	{ autoComplete: 'given-name', label: 'onboarding.name.firstName', name: 'firstName' },
	{ autoComplete: 'family-name', label: 'onboarding.name.lastName', name: 'lastName' },
] as const;

export function NameStep() {
	const { t } = useTranslation();
	const { control, formState } = useFormContext<OnboardingInput>();
	const id = useId();

	return (
		<QuestionnaireItem invalid={formState.errors.firstName !== undefined || formState.errors.lastName !== undefined} name='name' required>
			<QuestionnaireTitle>{t('onboarding.name.title')}</QuestionnaireTitle>
			<QuestionnaireDescription>{t('onboarding.name.description')}</QuestionnaireDescription>
			<FieldGroup className='grid gap-3 sm:grid-cols-2'>
				{NAME_FIELDS.map(({ autoComplete, label, name }) => (
					<Controller
						control={control}
						key={name}
						name={name}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${id}-${name}`}>{t(label)}</FieldLabel>
								<QuestionnaireInput
									aria-describedby={fieldState.error === undefined ? undefined : `${id}-${name}-error`}
									aria-invalid={fieldState.invalid || undefined}
									autoComplete={autoComplete}
									id={`${id}-${name}`}
									onBlur={field.onBlur}
									onChange={event => field.onChange(event.target.value)}
									ref={field.ref}
									value={field.value}
								/>
								<FormFieldError error={fieldState.error} id={`${id}-${name}-error`} />
							</Field>
						)}
					/>
				))}
			</FieldGroup>
		</QuestionnaireItem>
	);
}
