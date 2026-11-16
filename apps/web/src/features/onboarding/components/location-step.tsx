'use client';

import { type OnboardingInput, resolveLanguage } from '@tempi/core';
import { useId } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { QuestionnaireDescription, QuestionnaireItem, QuestionnaireTitle } from '@/components/ui/questionnaire';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countryTimeZones, timeZoneLabel } from '@/lib/countries';
import { CountryCombobox } from './country-combobox';

export function LocationStep() {
	const { t, i18n } = useTranslation();
	const language = resolveLanguage([i18n.language]);
	const { control, setValue } = useFormContext<OnboardingInput>();
	const country = useController({ control, name: 'country' });
	const timeZone = useController({ control, name: 'timeZone' });
	const id = useId();

	const zones = country.field.value === '' ? [] : countryTimeZones(country.field.value);
	const zoneItems = zones.map(zone => ({ label: timeZoneLabel(zone, language), value: zone }));

	// A new country keeps the current zone only if it belongs to it; otherwise its main zone is the best guess.
	const changeCountry = (code: string) => {
		country.field.onChange(code);
		const next = countryTimeZones(code);
		if (!next.includes(timeZone.field.value) && next[0] !== undefined) setValue('timeZone', next[0], { shouldValidate: timeZone.fieldState.invalid });
	};

	return (
		<QuestionnaireItem invalid={country.fieldState.invalid || timeZone.fieldState.invalid} name='location' required>
			<QuestionnaireTitle>{t('onboarding.location.title')}</QuestionnaireTitle>
			<QuestionnaireDescription>{t('onboarding.location.description')}</QuestionnaireDescription>
			<FieldGroup className='gap-4'>
				<Field data-invalid={country.fieldState.invalid || undefined}>
					<FieldLabel htmlFor={`${id}-country`}>{t('onboarding.location.country')}</FieldLabel>
					<CountryCombobox id={`${id}-country`} invalid={country.fieldState.invalid} onChange={changeCountry} ref={country.field.ref} value={country.field.value} />
					<FormFieldError error={country.fieldState.error} />
				</Field>
				{zoneItems.length > 1 ? (
					<Field data-invalid={timeZone.fieldState.invalid || undefined}>
						<FieldLabel htmlFor={`${id}-time-zone`}>{t('onboarding.location.timeZone')}</FieldLabel>
						<Select items={zoneItems} onValueChange={value => value !== null && timeZone.field.onChange(value)} value={timeZone.field.value}>
							<SelectTrigger aria-invalid={timeZone.fieldState.invalid || undefined} className='w-full' id={`${id}-time-zone`} ref={timeZone.field.ref}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{zoneItems.map(item => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FormFieldError error={timeZone.fieldState.error} />
					</Field>
				) : (
					zoneItems[0] !== undefined && (
						<FieldDescription>
							{t('onboarding.location.timeZone')}: {zoneItems[0].label}
						</FieldDescription>
					)
				)}
			</FieldGroup>
		</QuestionnaireItem>
	);
}
