'use client';

import { AppleDark, Linux, Windows } from '@ridemountainpig/svgl-react';
import { cn } from 'cn';
import { ChevronDownIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DOWNLOADS } from '@/lib/downloads';
import { PLATFORM_NAMES, type Platform } from '@/lib/platform';

// Monochrome like the rest of the page: Apple's mark is already white; the others are desaturated.
const ICONS = {
	macos: <AppleDark aria-hidden className='size-4' />,
	windows: <Windows aria-hidden className='size-4 brightness-200 grayscale' />,
	linux: <Linux aria-hidden className='size-4 grayscale' />,
} satisfies Record<Platform, React.ReactNode>;

const PILL = 'h-11 rounded-full border-foreground/15 bg-background/30! px-5 text-sm backdrop-blur-md hover:bg-background/50!';

/** One platform's download: a direct link when it ships a single file, a menu of variants otherwise. */
export function PlatformButton({ platform, chooseLabel }: { platform: Platform; chooseLabel: string }) {
	const variants = DOWNLOADS[platform];
	const name = PLATFORM_NAMES[platform];

	if (variants.length === 1) {
		return (
			<a href={variants[0].url} className={cn(buttonVariants({ variant: 'outline', className: `${PILL} gap-2` }))}>
				{ICONS[platform]}
				{name}
			</a>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant='outline' className={`${PILL} gap-2 pr-4`} aria-label={chooseLabel.replace('{os}', name)} />}>
				{ICONS[platform]}
				{name}
				<ChevronDownIcon data-icon='inline-end' className='opacity-60' />
			</DropdownMenuTrigger>
			<DropdownMenuContent align='center' className='w-44'>
				{variants.map(variant => (
					<DropdownMenuItem key={variant.key} render={<a href={variant.url} />}>
						{variant.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
