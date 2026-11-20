'use client';

import { cn } from 'cn';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { gsap, ScrollTrigger, useMotion } from '@/lib/gsap';

type ShowcaseSectionProps = {
	id?: string;
	/** Its place among the landing's showcase sections, written as `001`. */
	index: number;
	eyebrow: string;
	title: string;
	subtitle: string;
	children: ReactNode;
};

/** A numbered landing section: intro, then a grid of cells that each show a small piece of the real app. */
export function ShowcaseSection({ id, index, eyebrow, title, subtitle, children }: ShowcaseSectionProps) {
	const ref = useRef<HTMLElement>(null);

	useMotion(ref, () => {
		gsap.from('[data-showcase-intro]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 75%' } });
		// Batched, so each row of cells arrives as it scrolls in rather than all with the first one.
		const cells = gsap.utils.toArray<HTMLElement>('[data-showcase-cell]', ref.current);
		gsap.set(cells, { y: 24, autoAlpha: 0 });
		ScrollTrigger.batch(cells, {
			start: 'top 90%',
			once: true,
			onEnter: batch => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.1, ease: 'power3.out' }),
		});
	});

	return (
		<section ref={ref} id={id} className='mx-auto w-full max-w-6xl px-4 sm:px-6'>
			{/* Dashed rails frame the section from its intro to the end of its grid. */}
			<div className='border-dashed md:border-x'>
				<div className='px-0 pt-24 pb-12 md:px-8 md:pt-32'>
					<p data-showcase-intro className='font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase'>
						<span className='text-muted-foreground/60'>{String(index).padStart(3, '0')}</span>
						<span className='ml-3'>{eyebrow}</span>
					</p>
					<h2 data-showcase-intro className='mt-5 max-w-3xl font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl'>
						{title}
					</h2>
					<p data-showcase-intro className='mt-5 max-w-xl text-base leading-relaxed text-foreground/70'>
						{subtitle}
					</p>
				</div>
				{children}
			</div>
		</section>
	);
}

/** Two columns from `md` up; cells share their borders like a table. */
export function ShowcaseGrid({ children }: { children: ReactNode }) {
	return <ul className='grid border-t md:grid-cols-2 md:*:odd:border-r'>{children}</ul>;
}

type ShowcaseCellProps = {
	title: string;
	body: string;
	badge?: string;
	note?: string;
	/** The replica on top. It is decorative: the title and body say what it shows. */
	children: ReactNode;
	className?: string;
};

export function ShowcaseCell({ title, body, badge, note, children, className }: ShowcaseCellProps) {
	return (
		<li data-showcase-cell className={cn('flex min-w-0 flex-col border-b', className)}>
			{/* Pinned to the top: a replica taller than the cell is cut only at the bottom, where it fades out, as at the sides. */}
			<div
				aria-hidden
				inert
				className='relative flex h-96 justify-center overflow-hidden px-6 select-none mask-intersect sm:px-10 items-start pt-10 mask-[linear-gradient(to_bottom,black_75%,transparent),linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]'
			>
				{children}
			</div>
			<div className='px-0 pt-2 pb-8 md:px-8'>
				<h3 className='flex flex-wrap items-center gap-2 text-base font-medium'>
					{title}
					{badge && <Badge variant='outline'>{badge}</Badge>}
				</h3>
				<p className='mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground'>{body}</p>
				{note && <p className='mt-1.5 text-xs leading-relaxed text-muted-foreground/80'>{note}</p>}
			</div>
		</li>
	);
}

/** Starts a replica's timeline once, when it scrolls into view. */
export const onEnter = (trigger: Element | null) => ({ trigger, start: 'top 80%', once: true }) as const;
