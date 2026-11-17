'use client';

import { resolveLanguage } from '@tempi/core';
import * as flags from 'country-flag-icons/react/3x2';
import { ChevronsUpDownIcon } from 'lucide-react';
import { type Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { countryOptions } from '@/lib/countries';

const isFlagCode = (code: string): code is keyof typeof flags => Object.hasOwn(flags, code);

function CountryFlag({ code }: { code: string }) {
	if (!isFlagCode(code)) return null;
	const Flag = flags[code];
	return <Flag aria-hidden='true' className='h-3 w-4.5 shrink-0 rounded-[2px]' />;
}

type CountryComboboxProps = {
	id: string;
	invalid: boolean;
	onChange: (code: string) => void;
	ref: Ref<HTMLButtonElement>;
	required?: boolean;
	/** ISO 3166-1 alpha-2 code, or '' for none. */
	value: string;
};

/** Searchable country picker showing each country's flag and its name in the UI language. */
export function CountryCombobox({ id, invalid, onChange, ref, required = false, value }: CountryComboboxProps) {
	const { t, i18n } = useTranslation();
	const [open, setOpen] = useState(false);
	const options = countryOptions(resolveLanguage([i18n.language]));
	const selected = options.find(option => option.code === value.toUpperCase());

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
						<span className='flex min-w-0 items-center gap-2'>
							{selected !== undefined && <CountryFlag code={selected.code} />}
							<span className={selected === undefined ? 'truncate text-muted-foreground' : 'truncate'}>{selected?.name ?? t('onboarding.location.countryPlaceholder')}</span>
						</span>
						<ChevronsUpDownIcon aria-hidden='true' className='text-muted-foreground' />
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-(--anchor-width) min-w-64 p-0'>
				<Command>
					<CommandInput placeholder={t('onboarding.location.countrySearch')} />
					<CommandList>
						<CommandEmpty>{t('onboarding.location.countryEmpty')}</CommandEmpty>
						<CommandGroup>
							{options.map(option => (
								<CommandItem
									data-checked={option.code === selected?.code}
									key={option.code}
									keywords={option.keywords}
									onSelect={() => {
										onChange(option.code);
										setOpen(false);
									}}
									value={option.name}
								>
									<CountryFlag code={option.code} />
									<span className='truncate'>{option.name}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
