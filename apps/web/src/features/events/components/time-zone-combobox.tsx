'use client';

import { resolveLanguage } from '@tempi/core';
import { ChevronsUpDownIcon } from 'lucide-react';
import { type Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { timeZoneLabel } from '@/lib/countries';

type TimeZoneComboboxProps = {
	/** Zones left out of the list, e.g. ones already chosen. */
	exclude?: readonly string[];
	id: string;
	invalid: boolean;
	onChange: (timeZone: string) => void;
	ref: Ref<HTMLButtonElement>;
	required?: boolean;
	/** The chosen zone; null shows `placeholder` instead. */
	value: string | null;
	placeholder?: string;
};

/** Searchable picker over every IANA time zone the platform knows, by name and offset. */
export function TimeZoneCombobox({ exclude = [], id, invalid, onChange, placeholder, ref, required = false, value }: TimeZoneComboboxProps) {
	const { i18n, t } = useTranslation();
	const [open, setOpen] = useState(false);
	const language = resolveLanguage([i18n.language]);
	// Labels are only needed while the list is open; building ~400 of them on every form render would be waste.
	const options = open
		? Intl.supportedValuesOf('timeZone')
				.filter(zone => !exclude.includes(zone))
				.map(zone => ({ label: timeZoneLabel(zone, language), zone }))
		: [];

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger
				render={
					<Button
						aria-expanded={open}
						aria-invalid={invalid || undefined}
						aria-required={required || undefined}
						className='w-full justify-between font-normal'
						id={id}
						ref={ref}
						role='combobox'
						variant='outline'
					>
						<span className={value === null ? 'truncate text-muted-foreground' : 'truncate'}>{value === null ? placeholder : timeZoneLabel(value, language)}</span>
						<ChevronsUpDownIcon aria-hidden='true' className='text-muted-foreground' />
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-(--anchor-width) min-w-64 p-0'>
				<Command>
					<CommandInput placeholder={t('events.form.timeZoneSearch')} />
					<CommandList>
						<CommandEmpty>{t('events.form.timeZoneEmpty')}</CommandEmpty>
						<CommandGroup>
							{options.map(option => (
								<CommandItem
									data-checked={option.zone === value}
									key={option.zone}
									keywords={[option.zone]}
									onSelect={() => {
										onChange(option.zone);
										setOpen(false);
									}}
									value={option.label}
								>
									<span className='truncate'>{option.label}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
