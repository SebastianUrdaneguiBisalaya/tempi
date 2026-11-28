'use client';

import { ChevronDownIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { track } from '@/lib/analytics';
import { hasLocale, type Locale, locales } from '@/lib/i18n';

type LanguageSwitcherProps = {
	locale: Locale;
	label: string;
};

// Each language is shown by its own name ("English", "Español"), whatever the page locale is.
function nativeName(locale: Locale) {
	const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
	return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

export function LanguageSwitcher({ locale, label }: LanguageSwitcherProps) {
	const router = useRouter();
	const pathname = usePathname();

	function changeLocale(next: string) {
		if (next === locale || !hasLocale(next)) return;
		track('language_change', { from: locale, to: next });
		// Keep the page and the hash so the visitor lands on the same spot in the other language.
		router.push(`${pathname.replace(/^\/[^/]+/, `/${next}`)}${window.location.hash}`);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant='outline' size='sm' className='rounded-full px-3' aria-label={label} />}>
				{locale.toUpperCase()}
				<ChevronDownIcon data-icon='inline-end' />
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-36' data-lenis-prevent>
				<DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
					{locales.map(option => (
						<DropdownMenuRadioItem key={option} value={option} lang={option}>
							{nativeName(option)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
