'use client';

import type { AiSettings, TextProvider } from '@tempi/core';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ProviderSelectProps = {
	/** The providers with a key; only these are offered. */
	enabled: TextProvider[];
	value: TextProvider;
	onChange: (provider: TextProvider) => void;
	settings: AiSettings;
};

/** Picks the text provider that answers, showing the model chosen for it in Settings. */
export function ProviderSelect({ enabled, onChange, settings, value }: ProviderSelectProps) {
	const { t } = useTranslation();
	const items = enabled.map(provider => ({ label: t(`settings.integrations.ai.providers.${provider}.title`), value: provider }));
	return (
		<>
			<Select items={items} onValueChange={next => next !== null && onChange(next)} value={value}>
				<SelectTrigger aria-label={t('assistant.prompt.provider')} className='min-w-0' size='sm'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map(item => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<span className='min-w-0 truncate text-muted-foreground'>{settings.models[value]}</span>
		</>
	);
}
