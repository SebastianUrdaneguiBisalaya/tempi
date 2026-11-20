'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnthropicDark, AnthropicLight, Gemini, GrokDark, GrokLight, Groq, OpenAIDark, OpenAILight } from '@ridemountainpig/svgl-react';
import {
	type AiProvider,
	type AiSettings,
	aiKeyInputSchema,
	aiSettingsPatchSchema,
	ELEVENLABS_STT_MODELS,
	ELEVENLABS_TTS_MODELS,
	LANGUAGES,
	QUICK_ADD_MODES,
	TEXT_MODELS,
	TEXT_PROVIDERS,
	type TextProvider,
	zodErrorKeyMap,
} from '@tempi/core';
import { KeyRoundIcon, ShieldAlertIcon, Trash2Icon } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormFieldError } from '@/components/form-field-error';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { quickAddProviderOf, useAiSettings, useAiVoices, useRemoveAiKey, useSaveAiKey, useSaveAiSettings, useTestAiKey } from '../hooks/use-ai';
import { ElevenLabsLogo } from './elevenlabs-logo';
import { showFieldErrors } from './field-errors';

/** Light and dark variants swap with the theme; single-color marks show in both. */
const LOGOS: Record<AiProvider, ReactNode> = {
	anthropic: (
		<>
			<AnthropicLight aria-hidden className='size-8 dark:hidden' />
			<AnthropicDark aria-hidden className='hidden size-8 dark:block' />
		</>
	),
	elevenlabs: <ElevenLabsLogo aria-hidden className='size-8' />,
	google: <Gemini aria-hidden className='size-8' />,
	groq: <Groq aria-hidden className='size-8' />,
	openai: (
		<>
			<OpenAILight aria-hidden className='size-8 dark:hidden' />
			<OpenAIDark aria-hidden className='hidden size-8 dark:block' />
		</>
	),
	xai: (
		<>
			<GrokLight aria-hidden className='size-8 dark:hidden' />
			<GrokDark aria-hidden className='hidden size-8 dark:block' />
		</>
	),
};

const keySchema = aiKeyInputSchema.pick({ key: true });
const isKeyField = (field: string): field is 'key' => field === 'key';

/** A masked field to paste a key; saving tests it first and keeps it only if the provider accepts it. */
function KeyForm({ provider }: { provider: AiProvider }) {
	const { t } = useTranslation();
	const id = useId();
	const saveKey = useSaveAiKey();
	const form = useForm<z.input<typeof keySchema>, unknown, z.output<typeof keySchema>>({ defaultValues: { key: '' }, resolver: zodResolver(keySchema, { error: zodErrorKeyMap }) });

	const submit = form.handleSubmit(({ key }) => saveKey.mutate({ key, provider }, { onError: error => showFieldErrors(error, form.setError, isKeyField), onSuccess: () => form.reset({ key: '' }) }));

	return (
		<form className='flex w-full flex-col gap-2 sm:flex-row sm:items-start' noValidate onSubmit={submit}>
			<Controller
				control={form.control}
				name='key'
				render={({ field, fieldState }) => (
					<Field className='flex-1' data-invalid={fieldState.invalid || undefined}>
						<FieldLabel className='sr-only' htmlFor={`${id}-key`}>
							{t('settings.integrations.ai.keyLabel')}
						</FieldLabel>
						<Input
							aria-describedby={fieldState.error === undefined ? undefined : `${id}-key-error`}
							aria-invalid={fieldState.invalid || undefined}
							autoComplete='off'
							id={`${id}-key`}
							onBlur={field.onBlur}
							onChange={event => field.onChange(event.target.value)}
							placeholder={t('settings.integrations.ai.keyPlaceholder')}
							ref={field.ref}
							required
							spellCheck={false}
							type='password'
							value={field.value}
						/>
						<FormFieldError error={fieldState.error} id={`${id}-key-error`} />
					</Field>
				)}
			/>
			<Button disabled={saveKey.isPending} size='sm' type='submit' variant='outline'>
				{saveKey.isPending ? <Spinner data-icon='inline-start' /> : <KeyRoundIcon data-icon='inline-start' />}
				{t('settings.integrations.ai.saveKey')}
			</Button>
		</form>
	);
}

/** Test and remove actions for a saved key; removing asks first. */
function SavedKey({ provider }: { provider: AiProvider }) {
	const { t } = useTranslation();
	const testKey = useTestAiKey();
	const removeKey = useRemoveAiKey();
	const [confirming, setConfirming] = useState(false);
	const name = t(`settings.integrations.ai.providers.${provider}.title`);

	return (
		<div className='flex w-full flex-wrap items-center gap-2'>
			<p className='mr-auto font-mono text-muted-foreground' title={t('settings.integrations.ai.keySaved')}>
				<span className='sr-only'>{t('settings.integrations.ai.keySaved')}</span>
				<span aria-hidden>••••••••••••</span>
			</p>
			<Button disabled={testKey.isPending} onClick={() => testKey.mutate(provider)} size='sm' variant='outline'>
				{testKey.isPending && <Spinner data-icon='inline-start' />}
				{t('settings.integrations.ai.testKey')}
			</Button>
			<Button disabled={removeKey.isPending} onClick={() => setConfirming(true)} size='sm' variant='outline'>
				<Trash2Icon data-icon='inline-start' />
				{t('settings.integrations.ai.removeKey')}
			</Button>
			<AlertDialog onOpenChange={setConfirming} open={confirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('settings.integrations.ai.confirmTitle', { provider: name })}</AlertDialogTitle>
						<AlertDialogDescription>{t('settings.integrations.ai.confirmDescription', { provider: name })}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setConfirming(false);
								removeKey.mutate(provider);
							}}
							variant='destructive'
						>
							{t('settings.integrations.ai.removeKey')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

type Option = { label: string; value: string };

/** Saves a choice made in a select, checked against the core schema since select values are plain strings. */
const useSaveChoice = () => {
	const save = useSaveAiSettings();
	return (patch: unknown) => {
		const parsed = aiSettingsPatchSchema.safeParse(patch);
		if (parsed.success) save.mutate(parsed.data);
		else console.error('Ignored an AI setting outside the allowed options', parsed.error.message);
	};
};

/** A select that saves as soon as the user picks an option. */
function SettingSelect({ label, onChange, options, placeholder, value }: { label: string; onChange: (value: string) => void; options: Option[]; placeholder?: string; value: string | null }) {
	const id = useId();
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Select items={options} onValueChange={next => next !== null && next !== value && onChange(next)} value={value}>
				<SelectTrigger className='w-full sm:w-64' id={id}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{options.map(option => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

const asOptions = (values: readonly string[]): Option[] => values.map(value => ({ label: value, value }));

function ProviderCard({ children, hasKey, provider }: { children?: ReactNode; hasKey: boolean; provider: AiProvider }) {
	const { t } = useTranslation();
	const titleId = useId();
	return (
		<section aria-labelledby={titleId}>
			<Card size='sm'>
				<CardHeader>
					<div className='flex items-center gap-3'>
						<span className='flex size-8 shrink-0 items-center justify-center'>{LOGOS[provider]}</span>
						<div className='flex min-w-0 flex-col gap-0.5'>
							<CardTitle>
								<h3 id={titleId}>{t(`settings.integrations.ai.providers.${provider}.title`)}</h3>
							</CardTitle>
							<CardDescription>{t(`settings.integrations.ai.providers.${provider}.description`)}</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className='flex flex-col items-start gap-4'>
					{hasKey ? <SavedKey provider={provider} /> : <KeyForm provider={provider} />}
					{hasKey && children}
				</CardContent>
			</Card>
		</section>
	);
}

function TextProviderCard({ provider, settings }: { provider: TextProvider; settings: AiSettings }) {
	const { t } = useTranslation();
	const save = useSaveChoice();
	return (
		<ProviderCard hasKey={settings.keys[provider]} provider={provider}>
			<SettingSelect
				label={t('settings.integrations.ai.model')}
				onChange={model => save({ models: { [provider]: model } })}
				options={asOptions(TEXT_MODELS[provider])}
				value={settings.models[provider]}
			/>
		</ProviderCard>
	);
}

function ElevenLabsCard({ settings }: { settings: AiSettings }) {
	const { t } = useTranslation();
	const save = useSaveChoice();
	const hasKey = settings.keys.elevenlabs;
	const { data: voices, isPending } = useAiVoices(hasKey);
	const voiceOptions = (voices ?? []).map(voice => ({ label: voice.name, value: voice.id }));

	return (
		<ProviderCard hasKey={hasKey} provider='elevenlabs'>
			<FieldGroup className='gap-4'>
				<SettingSelect
					label={t('settings.integrations.ai.sttModel')}
					onChange={sttModel => save({ elevenlabs: { sttModel } })}
					options={asOptions(ELEVENLABS_STT_MODELS)}
					value={settings.elevenlabs.sttModel}
				/>
				<SettingSelect
					label={t('settings.integrations.ai.ttsModel')}
					onChange={ttsModel => save({ elevenlabs: { ttsModel } })}
					options={asOptions(ELEVENLABS_TTS_MODELS)}
					value={settings.elevenlabs.ttsModel}
				/>
				{LANGUAGES.map(language => (
					<SettingSelect
						key={language}
						label={t(`settings.integrations.ai.voice.${language}`)}
						onChange={voice => save({ elevenlabs: { voices: { [language]: voice } } })}
						options={voiceOptions}
						placeholder={isPending ? t('settings.integrations.ai.voicesLoading') : t('settings.integrations.ai.voicePlaceholder')}
						value={settings.elevenlabs.voices[language]}
					/>
				))}
			</FieldGroup>
		</ProviderCard>
	);
}

/**
 * How quick add reads typed text: the local parser, or a text provider with a saved key. AI stays disabled until one
 * has a key, and choosing it picks the first such provider unless one is already chosen.
 */
function QuickAddCard({ settings }: { settings: AiSettings }) {
	const { t } = useTranslation();
	const id = useId();
	const save = useSaveChoice();
	const withKey = TEXT_PROVIDERS.filter(provider => settings.keys[provider]);
	const active = quickAddProviderOf(settings);
	// A removed key turns AI off here too, matching what the command menu does.
	const mode = active === null ? 'local' : 'ai';
	const changeMode = (value: unknown) => {
		const next = QUICK_ADD_MODES.find(option => option === value);
		if (next === undefined || next === mode) return;
		const provider = settings.quickAdd.provider !== null && settings.keys[settings.quickAdd.provider] ? settings.quickAdd.provider : (withKey[0] ?? null);
		save({ quickAdd: next === 'local' ? { mode: 'local' } : { mode: 'ai', provider } });
	};

	return (
		<section aria-labelledby={`${id}-title`}>
			<Card size='sm'>
				<CardHeader>
					<CardTitle>
						<h3 id={`${id}-title`}>{t('settings.integrations.ai.quickAdd.title')}</h3>
					</CardTitle>
					<CardDescription>{t('settings.integrations.ai.quickAdd.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup className='gap-4'>
						<FieldSet>
							<FieldLegend className='sr-only' variant='label'>
								{t('settings.integrations.ai.quickAdd.title')}
							</FieldLegend>
							<RadioGroup className='flex flex-col gap-3 sm:flex-row sm:gap-4' onValueChange={changeMode} value={mode}>
								{QUICK_ADD_MODES.map(option => (
									<div className='flex items-center gap-2' key={option}>
										<RadioGroupItem disabled={option === 'ai' && withKey.length === 0} id={`${id}-${option}`} value={option} />
										<FieldLabel className='font-normal' htmlFor={`${id}-${option}`}>
											{t(`settings.integrations.ai.quickAdd.${option}`)}
										</FieldLabel>
									</div>
								))}
							</RadioGroup>
							{withKey.length === 0 && <FieldDescription>{t('settings.integrations.ai.quickAdd.noKey')}</FieldDescription>}
						</FieldSet>
						{mode === 'ai' && (
							<>
								<SettingSelect
									label={t('settings.integrations.ai.quickAdd.provider')}
									onChange={provider => save({ quickAdd: { provider } })}
									options={withKey.map(provider => ({ label: t(`settings.integrations.ai.providers.${provider}.title`), value: provider }))}
									placeholder={t('settings.integrations.ai.quickAdd.providerPlaceholder')}
									value={active}
								/>
								<p className='text-muted-foreground'>{t('settings.integrations.ai.quickAdd.note')}</p>
							</>
						)}
					</FieldGroup>
				</CardContent>
			</Card>
		</section>
	);
}

/** One card per AI provider: the user's own key, its model and, for ElevenLabs, its voices. With no key nothing calls a provider. */
export function AiIntegrations() {
	const { t } = useTranslation();
	const { data: settings } = useAiSettings();
	if (settings === undefined) return null;

	return (
		<>
			<p className='flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-muted-foreground'>
				<ShieldAlertIcon aria-hidden className='mt-0.5 size-4 shrink-0' />
				{t('settings.integrations.ai.privacy')}
			</p>
			<QuickAddCard settings={settings} />
			{TEXT_PROVIDERS.map(provider => (
				<TextProviderCard key={provider} provider={provider} settings={settings} />
			))}
			<ElevenLabsCard settings={settings} />
		</>
	);
}
