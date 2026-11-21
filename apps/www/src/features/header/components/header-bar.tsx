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
	nav: Record<(typeof NAV_ORDER)[number], string>;
	github: string;
	language: string;
	openMenu: string;
	closeMenu: string;
};

type HeaderBarProps = {
	locale: Locale;
	copy: HeaderCopy;
};

const NAV_ORDER = ['features', 'planning', 'ai', 'faq', 'download'] as const;

export function HeaderBar({ locale, copy }: HeaderBarProps) {
	const ref = useRef<HTMLElement>(null);
	const scrolled = useScrolled();
	const [menuOpen, setMenuOpen] = useState(false);
	const menuId = useId();

	useMotion(ref, () => {
		gsap.from('[data-header-item]', { y: -12, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out' });
	});

	// Near the top the pill is a little wider than the compact bar, not the full layout width; once the page scrolls it shrinks into a compact bar and grows back on return.
	const compact = scrolled && !menuOpen;

	return (
		<header
			ref={ref}
			onKeyDown={event => {
				if (event.key === 'Escape') setMenuOpen(false);
			}}
			className='fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4'
		>
			<div
				className={cn(
					'mx-auto flex items-center justify-between gap-4 rounded-full border pr-2 pl-4 backdrop-blur-xl backdrop-saturate-150 transition-[max-width,height,background-color,border-color,box-shadow] duration-500 ease-out',
					compact ? 'h-12 max-w-3xl border-border bg-background/70 shadow-lg shadow-black/30' : 'h-14 max-w-4xl border-foreground/10 bg-background/25'
				)}
			>
				<a href={`/${locale}`} aria-label={copy.home} className='flex items-center gap-1 rounded-full' data-header-item>
					{/* The icon has wide transparent padding; the negative margin keeps the dolphin aligned with the content. */}
					<Image src='/tempi-icon.png' alt='' width={40} height={40} priority className='-my-2 -ml-2.5 size-10' />
					<span className='font-heading text-base font-medium tracking-tight'>Tempi</span>
				</a>

				<nav aria-label={copy.navLabel} className='hidden items-center gap-6 md:flex'>
					{NAV_ORDER.map(section => (
						<a key={section} href={`/${locale}#${SECTION_IDS[section]}`} className='rounded-sm text-sm text-foreground/75 transition-colors hover:text-foreground' data-header-item>
							{copy.nav[section]}
						</a>
					))}
				</nav>

				<div className='hidden items-center gap-1 md:flex' data-header-item>
					<a href={GITHUB_URL} target='_blank' rel='noreferrer' aria-label={copy.github} className={cn(buttonVariants({ variant: 'ghost', size: 'icon', className: 'rounded-full' }))}>
						<GitHubDark aria-hidden className='size-4' />
					</a>
					<LanguageSwitcher locale={locale} label={copy.language} />
				</div>

				<Button
					variant='ghost'
					size='icon-lg'
					className='rounded-full md:hidden'
					aria-expanded={menuOpen}
					aria-controls={menuId}
					aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
					onClick={() => setMenuOpen(open => !open)}
					data-header-item
				>
					{menuOpen ? <XIcon /> : <MenuIcon />}
				</Button>
			</div>

			<div id={menuId} hidden={!menuOpen} className='mx-auto mt-2 max-w-6xl rounded-3xl border border-border bg-background/80 backdrop-blur-xl backdrop-saturate-150 md:hidden'>
				<nav aria-label={copy.navLabel} className='flex flex-col p-3'>
					{NAV_ORDER.map(section => (
						<a
							key={section}
							href={`/${locale}#${SECTION_IDS[section]}`}
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
