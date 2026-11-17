'use client';

import { CALENDAR_PALETTE } from '@tempi/core';
import { CheckIcon, PipetteIcon } from 'lucide-react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const COLOR_NAMES = ['red', 'orange', 'amber', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'fuchsia', 'pink'] as const;

type ColorFieldProps = {
	labelledBy: string;
	onChange: (color: string) => void;
	required?: boolean;
	value: string;
};

const swatchClass = 'flex size-7 items-center justify-center rounded-full outline-none ring-offset-2 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring';

/** The palette as a radio group, plus a Custom swatch that opens a color picker in a popover. */
export function ColorField({ labelledBy, onChange, required = false, value }: ColorFieldProps) {
	const { t } = useTranslation();
	const current = value.toLowerCase();
	const isCustom = !CALENDAR_PALETTE.some(color => color === current);

	return (
		<div aria-labelledby={labelledBy} aria-required={required || undefined} className='flex flex-wrap gap-2' role='radiogroup'>
			{CALENDAR_PALETTE.map((color, index) => {
				const checked = color === current;
				return (
					<button
						aria-checked={checked}
						aria-label={t(`calendars.colors.${COLOR_NAMES[index] ?? 'blue'}`)}
						className={swatchClass}
						key={color}
						onClick={() => onChange(color)}
						role='radio'
						style={{ backgroundColor: color }}
						type='button'
					>
						{checked && <CheckIcon aria-hidden className='size-4 text-white drop-shadow' />}
					</button>
				);
			})}
			<Popover>
				<PopoverTrigger
					aria-checked={isCustom}
					aria-label={t('calendars.customColor')}
					className={cn(swatchClass, 'border border-dashed border-muted-foreground')}
					role='radio'
					style={isCustom ? { backgroundColor: current, borderStyle: 'solid' } : undefined}
				>
					{isCustom ? <CheckIcon aria-hidden className='size-4 text-white drop-shadow' /> : <PipetteIcon aria-hidden className='size-3.5 text-muted-foreground' />}
				</PopoverTrigger>
				<PopoverContent className='flex w-auto flex-col gap-2'>
					<HexColorPicker color={current} onChange={onChange} />
					<HexColorInput aria-label={t('calendars.customColor')} className='h-7 rounded-md border bg-transparent px-2 text-xs uppercase' color={current} onChange={onChange} prefixed />
				</PopoverContent>
			</Popover>
		</div>
	);
}
