'use client';

import { type ComponentType, type Ref, useId } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ProfileFormFields } from './profile-fields';

const NAME_FIELDS = [
	{ autoComplete: 'given-name', label: 'onboarding.name.firstName', name: 'firstName' },
	{ autoComplete: 'family-name', label: 'onboarding.name.lastName', name: 'lastName' },
] as const;

type NameInputProps = {
	'aria-describedby'?: string;
	'aria-invalid'?: boolean;
	autoComplete: string;
	id: string;
	onBlur: () => void;
	onChange: (event: { target: { value: string } }) => void;
	ref: Ref<HTMLInputElement>;
	value: string;
};

/** First and last name, side by side on wide screens. `input` lets the onboarding use its questionnaire input. */
export function NameFields({ input: NameInput = Input }: { input?: ComponentType<NameInputProps> }) {
	const { t } = useTranslation();
	const { control } = useFormContext<ProfileFormFields>();
	const id = useId();

	return (
		<FieldGroup className='grid gap-3 sm:grid-cols-2'>
			{NAME_FIELDS.map(({ autoComplete, label, name }) => (
				<Controller
					control={control}
					key={name}
					name={name}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor={`${id}-${name}`}>{t(label)}</FieldLabel>
							<NameInput
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
	);
}
