'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type OnboardingInput, onboardingInputSchema, type Settings, zodErrorKeyMap } from '@tempi/core';
import Image from 'next/image';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { type FieldPath, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { Questionnaire, QuestionnaireActions, QuestionnaireNext, QuestionnairePrevious, QuestionnaireProgress, QuestionnaireSkip, QuestionnaireSubmit } from '@/components/ui/questionnaire';
import { countryForTimeZone, systemTimeZone } from '@/lib/countries';
import { useAppearancePreview } from '@/providers/appearance-preview-provider';
import { useCompleteOnboarding } from '../hooks/use-complete-onboarding';
import { AvatarStep } from './avatar-step';
import { LanguageStep } from './language-step';
import { LocationStep } from './location-step';
import { NameStep } from './name-step';
import { ThemeStep } from './theme-step';

type OnboardingOutput = z.output<typeof onboardingInputSchema>;

/** Steps in order, each with the fields it must validate before moving on. Only the avatar step is optional. */
const STEPS = [
	{ fields: ['firstName', 'lastName'], name: 'name' },
	{ fields: ['avatar'], name: 'avatar' },
	{ fields: ['country', 'timeZone'], name: 'location' },
	{ fields: ['theme'], name: 'theme' },
	{ fields: ['language'], name: 'language' },
] as const satisfies readonly { fields: readonly FieldPath<OnboardingInput>[]; name: string }[];

type StepName = (typeof STEPS)[number]['name'];
type FieldName = (typeof STEPS)[number]['fields'][number];

const isStepName = (value: string): value is StepName => STEPS.some(step => step.name === value);
const isFieldName = (value: string): value is FieldName => STEPS.some(step => step.fields.some(field => field === value));
const stepOf = (field: FieldName): StepName => STEPS.find(step => step.fields.some(name => name === field))?.name ?? STEPS[0].name;

/** Starts from the system time zone and its country, and the language and theme already in settings. */
const initialValues = (settings: Settings): OnboardingInput => {
	const timeZone = systemTimeZone();
	return { avatar: null, country: countryForTimeZone(timeZone) ?? '', firstName: '', language: settings.language, lastName: '', theme: settings.theme, timeZone };
};

const isTextEntry = (target: EventTarget) =>
	target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && !['button', 'checkbox', 'file', 'radio', 'reset', 'submit'].includes(target.type));

export function Onboarding({ settings }: { settings: Settings }) {
	const { t } = useTranslation();
	const { setPreview } = useAppearancePreview();
	const completeOnboarding = useCompleteOnboarding();
	const [step, setStep] = useState<StepName>(STEPS[0].name);
	const form = useForm<OnboardingInput, unknown, OnboardingOutput>({
		defaultValues: initialValues(settings),
		resolver: zodResolver(onboardingInputSchema, { error: zodErrorKeyMap }),
	});

	// Steps are validated with `trigger`, never a form submit, so react-hook-form doesn't re-validate on change by itself:
	// once a field shows an error, re-check it as the user edits so the error clears as soon as the value is valid.
	useEffect(() => {
		const { unsubscribe } = form.watch((_values, { name }) => {
			if (name !== undefined && form.getFieldState(name).invalid) void form.trigger(name);
		});
		return unsubscribe;
	}, [form]);

	const index = STEPS.findIndex(({ name }) => name === step);
	const progress = t('onboarding.progress', { current: index + 1, total: STEPS.length });

	const submit = form.handleSubmit(values =>
		completeOnboarding.mutate(values, {
			// Issues on fields go back to the form (the toast shows the rest); the first one's step is shown.
			onError: error => {
				const fields = error.issues.flatMap(issue => {
					const field = issue.field?.split('.')[0] ?? '';
					return isFieldName(field) ? [{ field, key: issue.key }] : [];
				});
				for (const { field, key } of fields) form.setError(field, { message: key });
				if (fields[0] !== undefined) setStep(stepOf(fields[0].field));
			},
			// The saved settings now hold the chosen theme and language.
			onSuccess: () => setPreview({}),
		})
	);

	// The questionnaire only knows whether a step has an answer; the zod schema decides whether it's valid, so every way forward comes here.
	const goNext = async () => {
		const current = STEPS[index];
		if (current === undefined || !(await form.trigger(current.fields, { shouldFocus: true }))) return;
		const next = STEPS[index + 1];
		if (next === undefined) await submit();
		else setStep(next.name);
	};

	const onNavigate = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		void goNext();
	};

	// Takes over the questionnaire's keyboard shortcuts for moving forward (Enter in a field, Cmd/Ctrl+Enter, ArrowRight); ArrowLeft stays native.
	const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
		const { key, target } = event;
		// Keys from portaled popups (the country search) bubble here through React but belong to them.
		const inForm = target instanceof Node && event.currentTarget.contains(target);
		const submitShortcut = key === 'Enter' && (event.metaKey || event.ctrlKey);
		const enterInField = key === 'Enter' && inForm && target instanceof HTMLInputElement;
		const arrowForward = key === 'ArrowRight' && inForm && !isTextEntry(target) && !(target instanceof HTMLInputElement && target.type === 'radio');
		if (!submitShortcut && !enterInField && !arrowForward) return;
		event.preventDefault();
		if (!event.repeat) void goNext();
	};

	return (
		<main className='grid min-h-svh w-full lg:grid-cols-2'>
			<div className='flex items-center justify-center p-4 sm:p-8'>
				<div className='flex w-full max-w-md flex-col gap-6'>
					<div className='flex flex-col items-start'>
						{/* The artwork is a white glyph with wide margins: inverted on light themes, pulled left so it lines up with the title. */}
						<Image alt='' className='-ml-5 size-20 invert dark:invert-0' height={80} priority src='/tempi-icon.png' width={80} />
						<h1 className='font-heading text-lg font-semibold'>{t('onboarding.title')}</h1>
					</div>
					<FormProvider {...form}>
						<Questionnaire
							aria-label={t('onboarding.title')}
							item={step}
							onItemChange={name => isStepName(name) && setStep(name)}
							onKeyDown={onKeyDown}
							onSubmit={event => event.preventDefault()}
						>
							<QuestionnaireProgress aria-label={t('onboarding.title')} aria-valuetext={progress}>
								{progress}
							</QuestionnaireProgress>
							<NameStep />
							<AvatarStep />
							<LocationStep />
							<ThemeStep />
							<LanguageStep />
							<QuestionnaireActions>
								<QuestionnairePrevious>{t('onboarding.actions.back')}</QuestionnairePrevious>
								<QuestionnaireSkip onClick={() => form.setValue('avatar', null)}>{t('onboarding.actions.skip')}</QuestionnaireSkip>
								<QuestionnaireNext onClick={onNavigate}>{t('onboarding.actions.next')}</QuestionnaireNext>
								<QuestionnaireSubmit disabled={completeOnboarding.isPending} onClick={onNavigate}>
									{t('onboarding.actions.finish')}
								</QuestionnaireSubmit>
							</QuestionnaireActions>
						</Questionnaire>
					</FormProvider>
				</div>
			</div>
			{/* Decorative only, so it's hidden from assistive tech and dropped on narrow screens where the form needs the room. */}
			<div className='relative hidden lg:block'>
				<Image alt='' className='object-cover' fill priority sizes='50vw' src='/bg-tempi.png' />
				{/* Fades the image into the page background so the seam with the form column isn't a hard edge, in either theme. */}
				<div className='absolute inset-0 bg-linear-to-r from-background via-background/40 via-30% to-transparent' />
			</div>
		</main>
	);
}
