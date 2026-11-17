'use client';

import { GitHubDark } from '@ridemountainpig/svgl-react';
import { cn } from 'cn';
import { MenuIcon, XIcon } from 'lucide-react';
import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { gsap, useMotion } from '@/lib/gsap';
import type { Locale } from '@/lib/i18n';
import { GITHUB_URL, SECTION_IDS } from '@/lib/site';
import { useScrolled } from '../hooks/use-scrolled';
import { LanguageSwitcher } from './language-switcher';

export type HeaderCopy = {
	home: string;
	navLabel: string;
	nav: Record<keyof typeof SECTION_IDS, string>;
	github: string;
	language: string;
	openMenu: string;
	closeMenu: string;
};

type HeaderBarProps = {
	locale: Locale;
	copy: HeaderCopy;
};

const NAV_ORDER = ['features', 'faq', 'download'] as const;

export function HeaderBar({ locale, copy }: HeaderBarProps) {
	const ref = useRef<HTMLElement>(null);
	const scrolled = useScrolled();
	const [menuOpen, setMenuOpen] = useState(false);
	const menuId = useId();

	useMotion(ref, () => {
		gsap.from('[data-header-item]', { y: -12, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out' });
	});

	const solid = scrolled || menuOpen;

	return (
		<header
			ref={ref}
			onKeyDown={event => {
				if (event.key === 'Escape') setMenuOpen(false);
			}}
			className={cn('fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300', solid ? 'border-border bg-background/70 backdrop-blur-xl backdrop-saturate-150' : 'border-transparent')}
		>
			<div className='mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6'>
				<a href='#' aria-label={copy.home} className='flex items-center gap-1 rounded-md' data-header-item>
					{/* The icon has wide transparent padding; the negative margin keeps the dolphin aligned with the content. */}
					<Image src='/tempi-icon.png' alt='' width={44} height={44} priority className='-my-2 -ml-2.5 size-11' />
					<span className='font-heading text-lg font-medium tracking-tight'>Tempi</span>
				</a>

				<nav aria-label={copy.navLabel} className='hidden items-center gap-7 md:flex'>
					{NAV_ORDER.map(section => (
						<a key={section} href={`#${SECTION_IDS[section]}`} className='rounded-sm text-sm text-foreground/75 transition-colors hover:text-foreground' data-header-item>
							{copy.nav[section]}
						</a>
					))}
					<div className='flex items-center gap-2' data-header-item>
						<a href={GITHUB_URL} target='_blank' rel='noreferrer' aria-label={copy.github} className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'rounded-full' })}>
							<GitHubDark aria-hidden className='size-4' />
						</a>
						<LanguageSwitcher locale={locale} label={copy.language} />
					</div>
				</nav>

				<Button
					variant='ghost'
					size='icon-lg'
					className='md:hidden'
					aria-expanded={menuOpen}
					aria-controls={menuId}
					aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
					onClick={() => setMenuOpen(open => !open)}
					data-header-item
				>
					{menuOpen ? <XIcon /> : <MenuIcon />}
				</Button>
			</div>

			<div id={menuId} hidden={!menuOpen} className='border-t border-border md:hidden'>
				<nav aria-label={copy.navLabel} className='mx-auto flex max-w-6xl flex-col px-4 py-3 sm:px-6'>
					{NAV_ORDER.map(section => (
						<a
							key={section}
							href={`#${SECTION_IDS[section]}`}
							onClick={() => setMenuOpen(false)}
							className='rounded-md px-2 py-3 text-base text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground'
						>
							{copy.nav[section]}
						</a>
					))}
					<div className='mt-2 flex items-center justify-between border-t border-border px-2 pt-4'>
						<a href={GITHUB_URL} target='_blank' rel='noreferrer' className='flex items-center gap-2 rounded-md text-sm text-foreground/80 hover:text-foreground'>
							<GitHubDark aria-hidden className='size-4' />
							{copy.github}
						</a>
						<LanguageSwitcher locale={locale} label={copy.language} />
					</div>
				</nav>
			</div>
		</header>
	);
}
